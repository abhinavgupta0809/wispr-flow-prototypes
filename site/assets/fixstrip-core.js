/* Phrase Repair core, shared by Phrase Repair, Journal Mode, Review Revisions and Voice Skills. Pure state
   and text logic with no DOM, so the tests can run it in Node. The text changes only through APPLY and
   UNDO, and APPLY touches only the selected range.

   "Check this phrase" highlights are demo data: each scenario names the span, its alternatives and what
   "Say it again" fills in. Nothing here measures recognition confidence. */
(function (root) {
  const PREPARED_DICTATION = 'Send the revised estimate to Maya by Tuesday, and keep the implementation details in the appendix.';

  /* Simulated speech for manual selections: a fixed lookup, keyed by the selected phrase in lower case.
     It stands in for a repeated phrase so recordings are repeatable. It is not speech recognition. */
  const SIMULATED_REPLACEMENTS = {tuesday: 'Thursday', 'fix trip': 'Fix Strip'};

  const HIGHLIGHT_LABEL = 'Check this phrase';

  /* Phrase Repair demos. Highlights, alternatives and repeats are prepared. The product-term scenario comes
     from a recognition error I reported from my own use ("Mobile Fix Strip" written as "mobile fix trip"). */
  const SCENARIOS = [
    {id: 'name', label: 'Name', text: 'Send the proposal to Risha.', thread: 'Product team', incoming: 'Who should get the proposal?',
      highlights: [{phrase: 'Risha', alternatives: ['Rishav', 'Rasha'], repeat: 'Rishav'}],
      goal: 'Choose or repeat “Rishav.”', expected: 'Send the proposal to Rishav.',
      source: 'Scripted sentence. The marked name and its alternatives are demo data.'},
    {id: 'product', label: 'Product term', text: 'Let’s prototype mobile fix trip.', thread: 'Design review', incoming: 'What should we build first?',
      highlights: [{phrase: 'mobile fix trip', alternatives: ['Mobile Fix Strip'], repeat: 'Mobile Fix Strip'}],
      goal: 'Replace it with “Mobile Fix Strip.”', expected: 'Let’s prototype Mobile Fix Strip.',
      source: 'Based on an error I reported from my own use: I said “Mobile Fix Strip” and Flow wrote “mobile fix trip.” The sentence is scripted.'},
    {id: 'multi', label: 'Multiple words', text: 'Schedule it for Tuesday at three.', thread: 'Ops', incoming: 'When should the review happen?',
      highlights: [{phrase: 'Tuesday at three', alternatives: ['Thursday at three', 'Tuesday at two thirty'], repeat: 'Thursday at two thirty'}],
      goal: 'Repeat “Thursday at two thirty.”', expected: 'Schedule it for Thursday at two thirty.',
      source: 'Scripted sentence. The span covers three words because that is what needs fixing.'},
    {id: 'false-alarm', label: 'False alarm', text: 'Ask Priya to review the onboarding checklist.', thread: 'Onboarding', incoming: 'Who checks the list?',
      highlights: [{phrase: 'Priya', alternatives: ['Pria', 'Freya'], repeat: 'Priya'}],
      goal: 'The name is already right. Keep as written.', expected: 'Ask Priya to review the onboarding checklist.',
      source: 'Scripted sentence. The highlight is deliberately wrong, to show that dismissing it changes nothing.'},
  ];
  const ALIASES = {'fix-trip': 'product', 'wrong-day': 'multi'};
  const scenarioById = (id) => SCENARIOS.find((s) => s.id === (ALIASES[id] || id)) || SCENARIOS[0];

  /* "[unclear]" is how a capture marks audio it couldn't make out; it is one token so it can be replaced whole. */
  const WORD = /\[unclear\]|[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

  function tokenize(text) {
    const tokens = [];
    let last = 0;
    for (const match of text.matchAll(WORD)) {
      if (match.index > last) tokens.push({text: text.slice(last, match.index), start: last, end: match.index, word: false});
      tokens.push({text: match[0], start: match.index, end: match.index + match[0].length, word: true});
      last = match.index + match[0].length;
    }
    if (last < text.length) tokens.push({text: text.slice(last), start: last, end: text.length, word: false});
    return tokens;
  }

  const initialState = () => ({
    phase: 'empty', text: '', dictation: null, sel: null, replacement: '', source: null, undo: null, lastChange: null,
    simulated: SIMULATED_REPLACEMENTS, highlights: [], active: null, sent: null, events: [],
  });

  const dictationText = (state) => (state.dictation ? state.text.slice(state.dictation.start, state.dictation.end) : '');
  const dictationTokens = (state) => tokenize(dictationText(state));

  /* Place each highlight spec on the text by its phrase (first match at or after the previous one). */
  function placeHighlights(text, specs = []) {
    let from = 0;
    return specs.map((h, i) => {
      const start = text.indexOf(h.phrase, from);
      if (start < 0) throw new Error(`Highlight "${h.phrase}" is not in the text.`);
      from = start + h.phrase.length;
      return {id: h.id || `h${i + 1}`, start, end: start + h.phrase.length, phrase: h.phrase, alternatives: h.alternatives || [], repeat: h.repeat || null, status: 'open'};
    });
  }

  const openHighlights = (state) => state.highlights.filter((h) => h.status === 'open');
  const activeHighlight = (state) => state.highlights.find((h) => h.id === state.active) || null;

  /* Absolute character range of the selection inside the composer text. */
  function selectionRange(state) {
    if (!state.sel || !state.dictation) return null;
    const tokens = dictationTokens(state);
    const start = state.dictation.start + tokens[state.sel.from].start;
    const end = state.dictation.start + tokens[state.sel.to].end;
    return {start, end, phrase: state.text.slice(start, end)};
  }

  /* Token indices (within the dictation) that cover an absolute range exactly. */
  function selFor(state, start, end) {
    const off = state.dictation.start;
    const tokens = dictationTokens(state);
    const from = tokens.findIndex((t) => t.word && t.start + off === start);
    const to = tokens.findIndex((t) => t.word && t.end + off === end);
    return from >= 0 && to >= from ? {from, to} : null;
  }

  const highlightForSelection = (state) => {
    const r = selectionRange(state);
    return r ? openHighlights(state).find((h) => h.start === r.start && h.end === r.end) || null : null;
  };

  function replaceRange(text, start, end, replacement) {
    return text.slice(0, start) + replacement + text.slice(end);
  }

  /* True when every character outside [start, end) survives unchanged and in place around the replacement. */
  function preservedOutside(before, after, start, end, replacement) {
    return after.slice(0, start) === before.slice(0, start)
      && after.slice(start, start + replacement.length) === replacement
      && after.slice(start + replacement.length) === before.slice(end)
      && after.length === before.length - (end - start) + replacement.length;
  }

  function simulatedReplacementFor(phrase, map = SIMULATED_REPLACEMENTS) {
    const key = phrase.toLowerCase();
    return map && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
  }

  /* What "Say it again" fills in for the current selection: the highlight's prepared repeat, else the lookup. */
  function sayAgainFor(state) {
    const h = activeHighlight(state);
    if (h && h.repeat) return h.repeat;
    const r = selectionRange(state);
    return r ? simulatedReplacementFor(r.phrase, state.simulated) : null;
  }

  const alternativesFor = (state) => (activeHighlight(state) ? activeHighlight(state).alternatives : []);

  function previewText(state) {
    const range = selectionRange(state);
    if (!range || state.phase !== 'preview') return null;
    return {before: state.text.slice(0, range.start), removed: range.phrase, inserted: state.replacement, after: state.text.slice(range.end)};
  }

  const log = (state, event) => [...state.events, event];

  function reduce(state, action) {
    switch (action.type) {
      case 'LOAD': {
        if (state.phase !== 'empty') return state;
        const text = action.text ?? PREPARED_DICTATION;
        return {...state, phase: 'idle', text, dictation: {start: 0, end: text.length}, simulated: action.phrases ?? state.simulated,
          highlights: placeHighlights(text, action.highlights), events: log(state, 'load')};
      }
      case 'OPEN_STRIP':
        if (state.phase !== 'idle' || !state.dictation) return state;
        return {...state, phase: 'strip', sel: null, active: null, events: log(state, 'open')};
      case 'CLOSE_STRIP':
        if (state.phase !== 'strip') return state;
        return {...state, phase: 'idle', sel: null};
      case 'OPEN_HIGHLIGHT': {
        if (!['idle', 'strip'].includes(state.phase)) return state;
        const h = state.highlights.find((x) => x.id === action.id && x.status === 'open');
        const sel = h && selFor(state, h.start, h.end);
        if (!sel) return state;
        return {...state, phase: 'replace', sel, active: h.id, replacement: '', source: null, events: log(state, `check:${h.phrase}`)};
      }
      case 'TAP': {
        if (state.phase !== 'strip') return state;
        const tokens = dictationTokens(state);
        const i = action.index;
        if (!tokens[i] || !tokens[i].word) return state;
        let sel;
        if (!state.sel) sel = {from: i, to: i};
        else if (i >= state.sel.from && i <= state.sel.to) sel = state.sel.from === state.sel.to ? null : {from: i, to: i};
        else sel = {from: Math.min(state.sel.from, i), to: Math.max(state.sel.to, i)};
        const next = {...state, sel};
        const range = selectionRange(next);
        return {...next, events: range ? log(state, `select:${range.phrase}`) : state.events};
      }
      case 'START_REPLACE': {
        if (state.phase !== 'strip' || !state.sel) return state;
        const h = highlightForSelection(state);
        return {...state, phase: 'replace', replacement: '', source: null, active: h ? h.id : null};
      }
      case 'SET_REPLACEMENT':
        if (state.phase !== 'replace') return state;
        return {...state, replacement: action.text, source: action.simulated ? 'speech' : 'typed', events: action.simulated ? log(state, 'simulated-speech') : state.events};
      case 'CHOOSE': {
        if (state.phase !== 'replace' || !action.text) return state;
        return {...state, phase: 'preview', replacement: action.text, source: 'alternative', events: [...state.events, `choose:${action.text}`, 'preview']};
      }
      case 'PREVIEW': {
        if (state.phase !== 'replace') return state;
        const replacement = state.replacement.trim();
        if (!replacement) return state;
        return {...state, phase: 'preview', replacement, source: state.source || 'typed', events: log(state, 'preview')};
      }
      case 'EDIT':
        if (state.phase !== 'preview') return state;
        return {...state, phase: 'replace'};
      case 'CANCEL':
        if (!['replace', 'preview'].includes(state.phase)) return state;
        return {...state, phase: 'strip', sel: null, replacement: '', source: null, active: null, events: log(state, 'cancel')};
      case 'DISMISS': {
        /* "Keep as written": the highlight goes away and the text is untouched. */
        const id = action.id || state.active;
        const h = state.highlights.find((x) => x.id === id && x.status === 'open');
        if (!h || !['idle', 'strip', 'replace', 'preview'].includes(state.phase)) return state;
        return {...state, phase: 'idle', sel: null, replacement: '', source: null, active: null,
          highlights: state.highlights.map((x) => (x.id === id ? {...x, status: 'dismissed'} : x)), events: log(state, `dismiss:${h.phrase}`)};
      }
      case 'APPLY': {
        if (state.phase !== 'preview') return state;
        const range = selectionRange(state);
        const text = replaceRange(state.text, range.start, range.end, state.replacement);
        const delta = state.replacement.length - (range.end - range.start);
        const highlights = state.highlights.map((h) => {
          if (h.status !== 'open') return h.start >= range.end ? {...h, start: h.start + delta, end: h.end + delta} : h;
          if (h.id === state.active || (h.start < range.end && h.end > range.start)) return {...h, status: 'resolved', end: h.start === range.start ? range.start + state.replacement.length : h.end};
          return h.start >= range.end ? {...h, start: h.start + delta, end: h.end + delta} : h;
        });
        return {
          ...state, phase: 'idle', text, sel: null, replacement: '', active: null, source: null, highlights,
          dictation: {start: state.dictation.start, end: state.dictation.end + delta},
          undo: {text: state.text, dictation: state.dictation, highlights: state.highlights},
          lastChange: {start: range.start, end: range.end, removed: range.phrase, inserted: state.replacement, source: state.source, before: state.text, after: text},
          events: log(state, 'apply'),
        };
      }
      case 'UNDO':
        if (!state.undo || state.phase !== 'idle') return state;
        return {...state, text: state.undo.text, dictation: state.undo.dictation, highlights: state.undo.highlights, undo: null, lastChange: null, events: log(state, 'undo')};
      case 'SEND':
        /* Highlights never block sending. */
        if (state.phase !== 'idle' || !state.text) return state;
        return {...state, phase: 'sent', sent: {text: state.text, openHighlights: openHighlights(state).length}, events: log(state, 'send')};
      case 'RESET':
        return initialState();
      default:
        return state;
    }
  }

  const api = {PREPARED_DICTATION, SIMULATED_REPLACEMENTS, HIGHLIGHT_LABEL, SCENARIOS, scenarioById, tokenize, initialState, reduce,
    selectionRange, dictationTokens, replaceRange, preservedOutside, simulatedReplacementFor, sayAgainFor, alternativesFor,
    activeHighlight, openHighlights, placeHighlights, previewText};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FixStrip = api;
})(typeof window !== 'undefined' ? window : globalThis);

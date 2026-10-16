/* Mobile Fix Strip: pure state and text logic. No DOM, so tests/fixstrip.test.js can run it in Node.
   The composer's text changes only through APPLY and UNDO, and APPLY touches only the selected range. */
(function (root) {
  const PREPARED_DICTATION = 'Send the revised estimate to Maya by Tuesday, and keep the implementation details in the appendix.';

  /* Simulated speech: a fixed lookup, keyed by the selected phrase in lower case. It stands in for a
     spoken replacement so recordings are repeatable. It is not speech recognition of any kind. */
  const SIMULATED_REPLACEMENTS = {tuesday: 'Thursday'};

  const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

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

  const initialState = () => ({phase: 'empty', text: '', dictation: null, sel: null, replacement: '', undo: null, lastChange: null, events: []});

  const dictationText = (state) => (state.dictation ? state.text.slice(state.dictation.start, state.dictation.end) : '');
  const dictationTokens = (state) => tokenize(dictationText(state));

  /* Absolute character range of the selection inside the composer text. */
  function selectionRange(state) {
    if (!state.sel || !state.dictation) return null;
    const tokens = dictationTokens(state);
    const start = state.dictation.start + tokens[state.sel.from].start;
    const end = state.dictation.start + tokens[state.sel.to].end;
    return {start, end, phrase: state.text.slice(start, end)};
  }

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

  function simulatedReplacementFor(phrase) {
    return Object.prototype.hasOwnProperty.call(SIMULATED_REPLACEMENTS, phrase.toLowerCase()) ? SIMULATED_REPLACEMENTS[phrase.toLowerCase()] : null;
  }

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
        return {...state, phase: 'idle', text, dictation: {start: 0, end: text.length}, events: log(state, 'load')};
      }
      case 'OPEN_STRIP':
        if (state.phase !== 'idle' || !state.dictation) return state;
        return {...state, phase: 'strip', sel: null, events: log(state, 'open')};
      case 'CLOSE_STRIP':
        if (state.phase !== 'strip') return state;
        return {...state, phase: 'idle', sel: null};
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
      case 'START_REPLACE':
        if (state.phase !== 'strip' || !state.sel) return state;
        return {...state, phase: 'replace', replacement: ''};
      case 'SET_REPLACEMENT':
        if (state.phase !== 'replace') return state;
        return {...state, replacement: action.text, events: action.simulated ? log(state, 'simulated-speech') : state.events};
      case 'PREVIEW': {
        if (state.phase !== 'replace') return state;
        const replacement = state.replacement.trim();
        if (!replacement) return state;
        return {...state, phase: 'preview', replacement, events: log(state, 'preview')};
      }
      case 'EDIT':
        if (state.phase !== 'preview') return state;
        return {...state, phase: 'replace'};
      case 'CANCEL':
        if (!['replace', 'preview'].includes(state.phase)) return state;
        return {...state, phase: 'strip', sel: null, replacement: '', events: log(state, 'cancel')};
      case 'APPLY': {
        if (state.phase !== 'preview') return state;
        const range = selectionRange(state);
        const text = replaceRange(state.text, range.start, range.end, state.replacement);
        const delta = state.replacement.length - (range.end - range.start);
        return {
          ...state, phase: 'idle', text, sel: null, replacement: '',
          dictation: {start: state.dictation.start, end: state.dictation.end + delta},
          undo: {text: state.text, dictation: state.dictation},
          lastChange: {start: range.start, end: range.end, removed: range.phrase, inserted: state.replacement, before: state.text, after: text},
          events: log(state, 'apply'),
        };
      }
      case 'UNDO':
        if (!state.undo || state.phase !== 'idle') return state;
        return {...state, text: state.undo.text, dictation: state.undo.dictation, undo: null, lastChange: null, events: log(state, 'undo')};
      case 'RESET':
        return initialState();
      default:
        return state;
    }
  }

  const api = {PREPARED_DICTATION, SIMULATED_REPLACEMENTS, tokenize, initialState, reduce, selectionRange, dictationTokens, replaceRange, preservedOutside, simulatedReplacementFor, previewText};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FixStrip = api;
})(typeof window !== 'undefined' ? window : globalThis);

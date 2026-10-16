/* Review Revisions: scenarios and pure state. No DOM, so tests/revisions.test.js can run it in Node.
   Each scenario renders its message from a set of decisions, sentence by sentence. The cards read the same
   decisions, so what a card shows and what the message says can't drift apart. Nothing here interprets
   speech: the decisions, earlier choices and excerpts are prepared by hand for the demo. */
(function (root) {
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const listNames = (names) => (names.length <= 1 ? names.join('') : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

  const GUEST_STATUSES = [['included', 'Included'], ['optional', 'Optional'], ['excluded', 'Excluded']];

  const SCENARIOS = [
    {
      id: 'plain', label: 'Plain dictation', short: 'No revisions',
      summary: 'A dictation with no spoken revisions. The message is used as is and no review control appears.',
      basis: 'scripted', basisNote: 'Scripted dictation.',
      input: 'Can you send me the slides from today’s review? I want to add the budget numbers before Friday.',
      excerpts: {},
      groups: [],
      initial: {},
      render: () => [{id: 'body', text: 'Can you send me the slides from today’s review? I want to add the budget numbers before Friday.'}],
    },
    {
      id: 'guests', label: 'A · Guest list', short: 'Exclude Sam, keep Leo',
      summary: 'My final intent was to keep Leo and exclude Sam, but the text includes both. The cards show what the text says, not what I meant, until I change it.',
      basis: 'reconstruction',
      basisNote: 'Reconstruction based on my reported intent (keep Leo, exclude Sam) in my second guest-list test, where the pasted output kept both. The recording hasn’t been checked yet, so no spoken excerpt is shown and no earlier choices are listed. The dinner details and Daniel are scripted.',
      input: null,
      excerpts: {},
      groups: [{id: 'guests', label: 'Guests', kind: 'people', people: ['Leo', 'Sam', 'Daniel'], statuses: GUEST_STATUSES, history: null}],
      initial: {guests: {Leo: 'included', Sam: 'included', Daniel: 'optional'}},
      render(d) {
        const by = (status) => Object.keys(d.guests).filter((n) => d.guests[n] === status);
        const coming = by('included');
        const maybe = by('optional');
        const out = [{id: 'event', text: 'Dinner is at my place on Saturday at 7:00 p.m.'}];
        out.push({id: 'coming', text: coming.length ? `${listNames(coming)} ${coming.length === 1 ? 'is' : 'are'} coming.` : 'Nobody is confirmed yet.'});
        if (maybe.length) out.push({id: 'maybe', text: `${listNames(maybe)} might join.`});
        return out;
      },
    },
    {
      id: 'schedule', label: 'B · Linked revisions', short: 'Change the day only',
      summary: 'Three decisions changed while speaking. Each can be changed on its own: restoring Friday keeps 2:00 p.m. and the smaller group.',
      basis: 'scripted', basisNote: 'Scripted input from the brief. In my own test of a similar dictation, Flow kept the final day and time but wrote “the smaller group” without naming who that was. This version names them.',
      input: 'Let’s meet Thursday at three with the whole team. Actually, Friday at two works better. Just invite engineering, plus Maya from support. No, keep Thursday, but use the smaller group and the two o’clock time.',
      excerpts: {
        s1: 'Let’s meet Thursday at three with the whole team.',
        s2: 'Actually, Friday at two works better.',
        s3: 'Just invite engineering, plus Maya from support.',
        s4: 'No, keep Thursday, but use the smaller group and the two o’clock time.',
      },
      groups: [
        {id: 'day', label: 'Date', kind: 'choice', history: [
          {value: 'Thursday', excerpt: 's1', heard: 'Thursday'},
          {value: 'Friday', excerpt: 's2', heard: 'Friday'},
          {value: 'Thursday', excerpt: 's4', heard: 'keep Thursday'}]},
        {id: 'time', label: 'Time', kind: 'choice', history: [
          {value: '3:00 p.m.', excerpt: 's1', heard: 'at three'},
          {value: '2:00 p.m.', excerpt: 's2', heard: 'at two'},
          {value: '2:00 p.m.', excerpt: 's4', heard: 'the two o’clock time'}]},
        {id: 'guests', label: 'Guests', kind: 'choice', history: [
          {value: 'the whole team', excerpt: 's1', heard: 'the whole team'},
          {value: 'engineering and Maya from support', excerpt: 's3', heard: 'engineering, plus Maya from support'},
          {value: 'engineering and Maya from support', excerpt: 's4', heard: 'the smaller group', note: '“The smaller group” points back to engineering plus Maya, so the message names them.'}]},
      ],
      initial: {day: 'Thursday', time: '2:00 p.m.', guests: 'engineering and Maya from support'},
      render: (d) => [{id: 'meet', text: `Let’s meet ${d.day} at ${d.time} with ${d.guests}.`}],
    },
    {
      id: 'unresolved', label: 'C · Unresolved', short: 'Choose, then confirm separately',
      summary: 'Nothing was decided. Picking a day doesn’t confirm it: “don’t confirm anything yet” stays until you remove it on purpose.',
      basis: 'scripted', basisNote: 'Scripted input from the brief.',
      input: 'We could meet Tuesday, Thursday, or Friday. Tuesday might be too early, and Friday depends on Maya’s availability. Thursday is probably best, but don’t confirm anything yet.',
      excerpts: {
        s1: 'We could meet Tuesday, Thursday, or Friday.',
        s2: 'Tuesday might be too early, and Friday depends on Maya’s availability.',
        s3: 'Thursday is probably best, but don’t confirm anything yet.',
      },
      groups: [
        {id: 'day', label: 'Date', kind: 'options', options: [
          {value: 'Thursday', status: 'preferred', label: 'Preferred', note: 'probably best', excerpt: 's3'},
          {value: 'Tuesday', status: 'possible', label: 'Possible', note: 'might be too early', excerpt: 's2'},
          {value: 'Friday', status: 'conditional', label: 'Conditional', note: 'depends on Maya’s availability', excerpt: 's2'}]},
        {id: 'confirmed', label: 'Confirmation', kind: 'condition', excerpt: 's3', heard: 'don’t confirm anything yet'},
      ],
      initial: {day: null, confirmed: false},
      render(d) {
        if (!d.day) {
          return [
            {id: 'options', text: 'We could meet Tuesday, Thursday, or Friday.'},
            {id: 'notes', text: 'Tuesday might be too early, and Friday depends on Maya’s availability.'},
            {id: 'lean', text: 'Thursday is probably best, but don’t confirm anything yet.'},
          ];
        }
        if (d.confirmed) {
          return [{id: 'choice', text: d.day === 'Friday' ? 'Friday is confirmed, as long as Maya is available.' : `${d.day} is confirmed.`}];
        }
        const tentative = {Thursday: 'Let’s plan on Thursday.', Tuesday: 'Let’s plan on Tuesday, though it might be too early.', Friday: 'Let’s plan on Friday, if Maya is available.'}[d.day];
        return [{id: 'choice', text: tentative}, {id: 'confirm', text: 'Don’t confirm anything yet.'}];
      },
    },
  ];

  const scenarioById = (id) => SCENARIOS.find((s) => s.id === id) || SCENARIOS[1];
  const joinSentences = (sentences) => sentences.map((s) => s.text).join(' ');
  const outputOf = (scenario) => joinSentences(scenario.render(scenario.initial));
  const hasRevisions = (scenario) => scenario.groups.length > 0;

  /* Carry a decision change into the displayed message. A sentence is regenerated only if its rendered text
     changed; every other sentence keeps what is displayed now, including any phrase edits made by hand. */
  function mergeSentences(current, oldRender, newRender) {
    const changed = [];
    const overwritesEdit = [];
    const sentences = newRender.map((s) => {
      const old = oldRender.find((o) => o.id === s.id);
      const cur = current.find((c) => c.id === s.id);
      if (old && cur && old.text === s.text) return {...cur};
      changed.push(s.id);
      if (old && cur && cur.text !== old.text) overwritesEdit.push(s.id);
      return {...s};
    });
    const removed = current.filter((c) => !newRender.some((s) => s.id === c.id)).map((c) => c.id);
    return {sentences, changed, removed, overwritesEdit};
  }

  /* Apply a phrase edit made on the joined message text back onto its sentences. */
  function applyTextEdit(sentences, start, end, replacement) {
    let offset = 0;
    const spans = sentences.map((s) => { const span = {start: offset, end: offset + s.text.length}; offset = span.end + 1; return span; });
    const first = spans.findIndex((sp) => start <= sp.end);
    let last = spans.findIndex((sp) => end <= sp.end);
    if (first < 0 || last < 0) throw new Error('Edit outside the message.');
    last = Math.max(first, last);
    const joined = joinSentences(sentences);
    const text = joined.slice(spans[first].start, start) + replacement + joined.slice(end, spans[last].end);
    return [...sentences.slice(0, first), {...sentences[first], text}, ...sentences.slice(last + 1)];
  }

  function createState(scenarioId) {
    const scenario = scenarioById(scenarioId);
    const sentences = scenario.render(scenario.initial);
    return {
      scenarioId: scenario.id, applied: clone(scenario.initial), draft: null, preview: null,
      sentences, original: joinSentences(sentences), open: false, manualEdits: 0, undo: [], lastChange: null, events: [],
    };
  }

  const scenarioOf = (state) => scenarioById(state.scenarioId);
  const textOf = (state) => joinSentences(state.sentences);
  const log = (state, event) => [...state.events, event];

  function setPath(decisions, group, key, value) {
    const next = clone(decisions);
    if (key !== undefined && key !== null) next[group] = {...next[group], [key]: value};
    else next[group] = value;
    if (group === 'day' && value === null && 'confirmed' in next) next.confirmed = false; // can't confirm an unresolved day
    return next;
  }

  function buildPreview(state, draft) {
    const scenario = scenarioOf(state);
    const merged = mergeSentences(state.sentences, scenario.render(state.applied), scenario.render(draft));
    return {...merged, before: textOf(state), after: joinSentences(merged.sentences)};
  }

  /* Plain-language list of what a draft changes, for the preview and the undo toast. */
  function describeChanges(scenario, from, to) {
    const out = [];
    for (const g of scenario.groups) {
      if (same(from[g.id], to[g.id])) continue;
      if (g.kind === 'people') {
        for (const name of g.people) if (from[g.id][name] !== to[g.id][name]) out.push(`${name}: ${labelFor(GUEST_STATUSES, from[g.id][name])} → ${labelFor(GUEST_STATUSES, to[g.id][name])}`);
      } else if (g.kind === 'condition') out.push(`${g.label}: ${from[g.id] ? 'confirmed' : 'not confirmed'} → ${to[g.id] ? 'confirmed' : 'not confirmed'}`);
      else out.push(`${g.label}: ${from[g.id] ?? 'unresolved'} → ${to[g.id] ?? 'unresolved'}`);
    }
    return out;
  }
  const labelFor = (pairs, key) => (pairs.find(([k]) => k === key) || [key, key])[1];

  function reduce(state, action) {
    const scenario = scenarioOf(state);
    switch (action.type) {
      case 'OPEN':
        if (!hasRevisions(scenario)) return state;
        return {...state, open: true, events: log(state, 'open')};
      case 'CLOSE':
        return {...state, open: false, draft: null, preview: null};
      case 'SET': {
        if (!state.open || state.preview) return state;
        if (action.group === 'confirmed' && action.value && !(state.draft || state.applied).day) return state;
        let draft = setPath(state.draft || state.applied, action.group, action.key, action.value);
        if (same(draft, state.applied)) draft = null;
        return {...state, draft, events: log(state, `set:${action.group}${action.key ? '.' + action.key : ''}=${action.value}`)};
      }
      case 'PREVIEW':
        if (!state.draft) return state;
        return {...state, preview: buildPreview(state, state.draft), events: log(state, 'preview')};
      case 'BACK':
        return state.preview ? {...state, preview: null} : state;
      case 'CANCEL':
        if (!state.draft) return state;
        return {...state, draft: null, preview: null, events: log(state, 'cancel')};
      case 'APPLY': {
        if (!state.preview) return state;
        const changes = describeChanges(scenario, state.applied, state.draft);
        return {
          ...state, applied: state.draft, draft: null, preview: null, sentences: state.preview.sentences,
          undo: [...state.undo, {applied: state.applied, sentences: state.sentences, manualEdits: state.manualEdits}],
          lastChange: {kind: 'decision', changes, changed: state.preview.changed, before: state.preview.before, after: state.preview.after},
          events: log(state, 'apply'),
        };
      }
      case 'TEXT_EDIT': {
        /* From the shared phrase editor. `before` must be the displayed text, exactly. */
        if (action.before !== textOf(state)) return state;
        const sentences = applyTextEdit(state.sentences, action.start, action.end, action.inserted);
        return {
          ...state, sentences, manualEdits: state.manualEdits + 1,
          undo: [...state.undo, {applied: state.applied, sentences: state.sentences, manualEdits: state.manualEdits}],
          lastChange: {kind: 'text', changes: [`“${action.removed}” → “${action.inserted}”`], before: action.before, after: joinSentences(sentences)},
          events: log(state, 'text-edit'),
        };
      }
      case 'UNDO': {
        const last = state.undo[state.undo.length - 1];
        if (!last || state.preview) return state;
        return {...state, applied: last.applied, sentences: last.sentences, manualEdits: last.manualEdits, draft: null, undo: state.undo.slice(0, -1), lastChange: null, events: log(state, 'undo')};
      }
      case 'RESET':
        return createState(action.scenarioId || state.scenarioId);
      default:
        return state;
    }
  }

  const api = {SCENARIOS, GUEST_STATUSES, scenarioById, outputOf, hasRevisions, joinSentences, mergeSentences, applyTextEdit, createState, textOf, describeChanges, reduce};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReviewRevisions = api;
})(typeof window !== 'undefined' ? window : globalThis);

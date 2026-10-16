/* Journal Mode: pure state for the demo. No DOM, so tests/journal.test.js can run it in Node.
   The selected mode and the microphone are separate pieces of state, so the page can always show both.
   Nothing here records or recognizes audio: the captured entry is prepared text. */
(function (root) {
  const DEFAULT_PRESS_WINDOW_MS = 750;

  /* The demo entry. Two lines are quoted from my journal comparison, as given in the brief; everything else
     is scripted to show the preservation rules (repetition, unfinished thoughts, uncertainty, an unclear
     word). No names: the brief says names the transcripts disagree on stay out until checked. */
  const CAPTURE_SOURCES = [
    {text: 'Um, so today—sorry, yesterday, I had a fun day out with my friend.', source: 'journal', note: 'Opening line quoted in the brief from my journal comparison (it continues there; cut here).'},
    {text: 'We walked around for, I guess, three hours? Maybe more. And then we found this, this tiny burger place near the [unclear] station.', source: 'scripted', note: 'Scripted. Shows a hedge, a repetition and a word kept visibly unclear instead of guessed.'},
    {text: 'They were like the best damn burgers I’ve ever eaten.', source: 'journal', note: 'Quoted in the brief from my journal comparison.'},
    {text: 'I don’t know, I’m not sure why it felt so good. I think I just needed a day that wasn’t, like… a day that wasn’t about work.', source: 'scripted', note: 'Scripted. Shows uncertainty and an unfinished thought that restarts.'},
  ];
  const CAPTURED = `${CAPTURE_SOURCES[0].text} ${CAPTURE_SOURCES[1].text}\n\n${CAPTURE_SOURCES[2].text}\n\n${CAPTURE_SOURCES[3].text}`;

  /* The Polish result is written by hand for the demo. It keeps the unclear marker: smoothing never fills a gap. */
  const POLISHED = 'Yesterday I had a fun day out with my friend. We walked around for about three hours, maybe more, and then found a tiny burger place near the [unclear] station.\n\nThey were the best burgers I’ve ever eaten.\n\nI’m not sure why it felt so good. I think I just needed a day that wasn’t about work.';

  const PRESERVED = [
    ['Spoken revision', 'today—sorry, yesterday'],
    ['Expressive wording', 'the best damn burgers'],
    ['Uncertainty', 'I guess · Maybe more · I’m not sure · I think'],
    ['Repetition', 'this, this'],
    ['Unfinished thought', 'wasn’t, like… a day that wasn’t'],
    ['Unclear audio stays unclear', '[unclear]'],
  ];

  const VERSION_LABELS = {captured: 'Captured', polished: 'Polished'};

  const initialState = () => ({
    mode: 'normal', recording: false, presses: [], entry: null, notice: null, undo: [], events: [],
  });

  /* Triple press: three presses with the first and last no more than windowMs apart. */
  function registerPress(presses, now, windowMs = DEFAULT_PRESS_WINDOW_MS) {
    const recent = [...presses.filter((t) => now - t <= windowMs), now];
    if (recent.length >= 3) return {triggered: true, presses: []};
    return {triggered: false, presses: recent};
  }

  const version = (text) => ({text, original: text, edits: 0});
  const log = (state, event) => [...state.events, event];

  function reduce(state, action) {
    switch (action.type) {
      case 'PRESS': {
        if (state.recording) return state;
        const r = registerPress(state.presses, action.at, action.windowMs);
        if (!r.triggered) return {...state, presses: r.presses};
        return reduce({...state, presses: []}, {type: 'TOGGLE_MODE', via: 'triple-press'});
      }
      case 'TOGGLE_MODE': {
        if (state.recording) return state; // the mode is locked for the recording in progress
        const mode = state.mode === 'journal' ? 'normal' : 'journal';
        return {...state, mode, presses: [], notice: mode === 'normal' ? 'Journal Mode is off. Recordings use normal cleanup.' : null,
          events: log(state, `${mode === 'journal' ? 'journal-on' : 'journal-off'}:${action.via || 'button'}`)};
      }
      case 'START_RECORDING':
        if (state.recording || state.mode !== 'journal' || state.entry) return state;
        return {...state, recording: true, notice: null, events: log(state, 'record-start')};
      case 'STOP_RECORDING':
        if (!state.recording) return state;
        return {
          ...state, recording: false, mode: 'normal',
          entry: {captured: version(action.text ?? CAPTURED), polished: null, viewing: 'captured', kept: null, compare: false},
          notice: 'Journal Mode ended with this recording. The next one uses normal cleanup.',
          events: log(state, 'record-stop'),
        };
      case 'POLISH': {
        if (!state.entry) return state;
        const polished = state.entry.polished || version(action.text ?? POLISHED);
        return {...state, entry: {...state.entry, polished, viewing: 'polished', compare: true}, events: log(state, 'polish')};
      }
      case 'VIEW':
        if (!state.entry || !state.entry[action.version]) return state;
        return {...state, entry: {...state.entry, viewing: action.version}, events: log(state, `view:${action.version}`)};
      case 'COMPARE':
        if (!state.entry || !state.entry.polished) return state;
        return {...state, entry: {...state.entry, compare: action.on}};
      case 'KEEP':
        if (!state.entry || !state.entry[action.version]) return state;
        return {...state, entry: {...state.entry, kept: action.version}, events: log(state, `keep:${action.version}`)};
      case 'EDIT_APPLIED': {
        /* From the shared phrase editor: `before` must match the version's current text exactly. */
        const v = state.entry && state.entry[action.version];
        if (!v || v.text !== action.before) return state;
        return {
          ...state,
          entry: {...state.entry, [action.version]: {...v, text: action.after, edits: v.edits + 1}},
          undo: [...state.undo, {version: action.version, text: v.text, edits: v.edits}],
          events: log(state, `edit:${action.version}`),
        };
      }
      case 'UNDO': {
        const last = state.undo[state.undo.length - 1];
        if (!last || !state.entry) return state;
        const v = state.entry[last.version];
        return {...state, entry: {...state.entry, [last.version]: {...v, text: last.text, edits: last.edits}, viewing: last.version}, undo: state.undo.slice(0, -1), events: log(state, 'undo')};
      }
      case 'RESET':
        return initialState();
      default:
        return state;
    }
  }

  const api = {DEFAULT_PRESS_WINDOW_MS, CAPTURE_SOURCES, CAPTURED, POLISHED, PRESERVED, VERSION_LABELS, initialState, registerPress, reduce};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JournalMode = api;
})(typeof window !== 'undefined' ? window : globalThis);

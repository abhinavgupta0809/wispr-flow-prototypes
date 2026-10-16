const test = require('node:test');
const assert = require('node:assert/strict');
const FS = require('../site/assets/fixstrip-core.js');
const TD = require('../site/assets/textdiff.js');
const JM = require('../site/assets/journal-core.js');
const RR = require('../site/assets/revisions-core.js');
const REC = require('../site/assets/records-core.js');

const run = (reduce, actions, state) => actions.reduce((s, a) => reduce(s, a), state);

/* Phrase editor: the recognition-error scenario */
function selectPhrase(state, words) {
  const tokens = FS.dictationTokens(state);
  return words.reduce((s, w) => FS.reduce(s, {type: 'TAP', index: tokens.findIndex((t) => t.text === w)}), state);
}

test('fix trip becomes Fix Strip and the sentence around it is kept', () => {
  const sc = FS.scenarioById('fix-trip');
  let s = run(FS.reduce, [{type: 'LOAD', text: sc.text}, {type: 'OPEN_STRIP'}], FS.initialState());
  s = selectPhrase(s, ['fix', 'trip']);
  assert.equal(FS.selectionRange(s).phrase, 'fix trip');
  assert.equal(FS.simulatedReplacementFor('fix trip', s.simulated), 'Fix Strip');
  s = run(FS.reduce, [{type: 'START_REPLACE'}, {type: 'SET_REPLACEMENT', text: 'Fix Strip', simulated: true}, {type: 'PREVIEW'}], s);
  assert.equal(s.text, sc.text, 'preview does not change the text');
  s = FS.reduce(s, {type: 'APPLY'});
  assert.equal(s.text, 'Here’s the link to the mobile Fix Strip prototype. Can you try it before Friday’s review?');
  const c = s.lastChange;
  assert.ok(FS.preservedOutside(c.before, c.after, c.start, c.end, c.inserted));
  s = FS.reduce(s, {type: 'UNDO'});
  assert.equal(s.text, sc.text);
});

test('typed replacement works when no simulated phrase exists', () => {
  let s = run(FS.reduce, [{type: 'LOAD', text: 'Meet at the cafe.', phrases: {}}, {type: 'OPEN_STRIP'}], FS.initialState());
  s = selectPhrase(s, ['cafe']);
  assert.equal(FS.simulatedReplacementFor('cafe', s.simulated), null);
  s = run(FS.reduce, [{type: 'START_REPLACE'}, {type: 'SET_REPLACEMENT', text: 'library'}, {type: 'PREVIEW'}, {type: 'APPLY'}], s);
  assert.equal(s.text, 'Meet at the library.');
});

test('[unclear] is one tappable token', () => {
  const t = FS.tokenize('near the [unclear] station').filter((x) => x.word).map((x) => x.text);
  assert.deepEqual(t, ['near', 'the', '[unclear]', 'station']);
});

/* Text diff */
test('word diff reconstructs both sides', () => {
  const parts = TD.diffWords(JM.CAPTURED, JM.POLISHED);
  assert.equal(TD.sideOf(parts, 'del'), JM.CAPTURED);
  assert.equal(TD.sideOf(parts, 'ins'), JM.POLISHED);
  assert.deepEqual(TD.diffWords('a b c', 'a b c'), [{type: 'same', text: 'a b c'}]);
});

/* Journal Mode */
test('three presses inside the window turn Journal Mode on; slow presses do not', () => {
  let s = run(JM.reduce, [{type: 'PRESS', at: 0}, {type: 'PRESS', at: 300}, {type: 'PRESS', at: 600}], JM.initialState());
  assert.equal(s.mode, 'journal');
  s = run(JM.reduce, [{type: 'PRESS', at: 0}, {type: 'PRESS', at: 500}, {type: 'PRESS', at: 1000}], JM.initialState());
  assert.equal(s.mode, 'normal');
  s = run(JM.reduce, [{type: 'PRESS', at: 0, windowMs: 1200}, {type: 'PRESS', at: 500, windowMs: 1200}, {type: 'PRESS', at: 1000, windowMs: 1200}], JM.initialState());
  assert.equal(s.mode, 'journal', 'the window is adjustable');
});

test('the button also activates it; recording locks the mode and ends it afterwards', () => {
  let s = run(JM.reduce, [{type: 'START_RECORDING'}], JM.initialState());
  assert.equal(s.recording, false, 'the demo only scripts a Journal Mode capture');
  s = run(JM.reduce, [{type: 'TOGGLE_MODE'}, {type: 'START_RECORDING'}, {type: 'TOGGLE_MODE'}], JM.initialState());
  assert.equal(s.mode, 'journal');
  assert.equal(s.recording, true);
  s = JM.reduce(s, {type: 'STOP_RECORDING'});
  assert.equal(s.mode, 'normal', 'returns to normal capture');
  assert.equal(s.entry.captured.text, JM.CAPTURED);
  assert.match(s.notice, /next one uses normal cleanup/);
});

function captured() {
  return run(JM.reduce, [{type: 'TOGGLE_MODE'}, {type: 'START_RECORDING'}, {type: 'STOP_RECORDING'}], JM.initialState());
}

test('Polish makes a separate version and both survive switching and keeping', () => {
  let s = run(JM.reduce, [{type: 'POLISH'}], captured());
  assert.equal(s.entry.captured.text, JM.CAPTURED);
  assert.equal(s.entry.polished.text, JM.POLISHED);
  assert.equal(s.entry.viewing, 'polished');
  s = run(JM.reduce, [{type: 'KEEP', version: 'polished'}, {type: 'VIEW', version: 'captured'}, {type: 'KEEP', version: 'captured'}], s);
  assert.equal(s.entry.kept, 'captured');
  assert.equal(s.entry.captured.text, JM.CAPTURED);
  assert.equal(s.entry.polished.text, JM.POLISHED);
  s = JM.reduce(s, {type: 'POLISH'});
  assert.equal(s.entry.polished.text, JM.POLISHED, 'a second Polish does not overwrite');
});

test('phrase edits apply to either version and undo exactly', () => {
  let s = run(JM.reduce, [{type: 'POLISH'}], captured());
  const after = JM.POLISHED.replace('[unclear]', 'Fulton');
  s = JM.reduce(s, {type: 'EDIT_APPLIED', version: 'polished', before: JM.POLISHED, after});
  assert.equal(s.entry.polished.text, after);
  assert.equal(s.entry.captured.text, JM.CAPTURED, 'the other version is untouched');
  const cap2 = JM.CAPTURED.replace('three hours', 'four hours');
  s = JM.reduce(s, {type: 'EDIT_APPLIED', version: 'captured', before: JM.CAPTURED, after: cap2});
  assert.equal(JM.reduce(s, {type: 'EDIT_APPLIED', version: 'captured', before: 'stale', after: 'x'}), s, 'a stale edit is refused');
  s = JM.reduce(s, {type: 'UNDO'});
  assert.equal(s.entry.captured.text, JM.CAPTURED);
  s = JM.reduce(s, {type: 'UNDO'});
  assert.equal(s.entry.polished.text, JM.POLISHED);
  assert.deepEqual(JM.reduce(s, {type: 'RESET'}), JM.initialState());
});

test('the polished version keeps the unclear marker and adds no new facts', () => {
  assert.ok(JM.POLISHED.includes('[unclear]'));
  for (const fact of ['yesterday', 'three hours', 'burger', 'work']) assert.ok(JM.POLISHED.toLowerCase().includes(fact));
});

/* Review Revisions */
const rr = (id, actions) => run(RR.reduce, actions, RR.createState(id));

test('every scenario’s initial message is what its decisions render', () => {
  for (const sc of RR.SCENARIOS) assert.equal(RR.textOf(RR.createState(sc.id)), RR.outputOf(sc));
  assert.equal(RR.outputOf(RR.scenarioById('schedule')), 'Let’s meet Thursday at 2:00 p.m. with engineering and Maya from support.');
  assert.ok(!RR.hasRevisions(RR.scenarioById('plain')));
  assert.equal(RR.reduce(RR.createState('plain'), {type: 'OPEN'}).open, false, 'no review control for plain dictation');
});

test('A: the cards start from the output (both guests in); excluding Sam keeps Leo and Daniel', () => {
  let s = RR.createState('guests');
  assert.deepEqual(s.applied.guests, {Leo: 'included', Sam: 'included', Daniel: 'optional'});
  assert.match(RR.textOf(s), /Leo and Sam are coming\./);
  s = run(RR.reduce, [{type: 'OPEN'}, {type: 'SET', group: 'guests', key: 'Sam', value: 'excluded'}, {type: 'PREVIEW'}], s);
  assert.equal(RR.textOf(s), RR.outputOf(RR.scenarioById('guests')), 'preview does not change the message');
  assert.deepEqual(s.preview.changed, ['coming']);
  s = RR.reduce(s, {type: 'APPLY'});
  assert.equal(RR.textOf(s), 'Dinner is at my place on Saturday at 7:00 p.m. Leo is coming. Daniel might join.');
  assert.equal(s.applied.guests.Daniel, 'optional');
  s = RR.reduce(s, {type: 'UNDO'});
  assert.equal(RR.textOf(s), RR.outputOf(RR.scenarioById('guests')));
});

test('A: cancel discards the change', () => {
  const s = rr('guests', [{type: 'OPEN'}, {type: 'SET', group: 'guests', key: 'Sam', value: 'excluded'}, {type: 'PREVIEW'}, {type: 'CANCEL'}]);
  assert.equal(s.draft, null);
  assert.equal(RR.textOf(s), RR.outputOf(RR.scenarioById('guests')));
});

test('B: restoring Friday changes only the day', () => {
  const s = rr('schedule', [{type: 'OPEN'}, {type: 'SET', group: 'day', value: 'Friday'}, {type: 'PREVIEW'}, {type: 'APPLY'}]);
  assert.equal(RR.textOf(s), 'Let’s meet Friday at 2:00 p.m. with engineering and Maya from support.');
  assert.deepEqual(s.applied, {day: 'Friday', time: '2:00 p.m.', guests: 'engineering and Maya from support'});
});

test('C: choosing Thursday keeps “don’t confirm”; confirming is a separate step', () => {
  let s = rr('unresolved', [{type: 'OPEN'}, {type: 'SET', group: 'confirmed', value: true}]);
  assert.equal(s.draft, null, 'cannot confirm an unresolved day');
  s = run(RR.reduce, [{type: 'SET', group: 'day', value: 'Thursday'}, {type: 'PREVIEW'}, {type: 'APPLY'}], s);
  assert.equal(RR.textOf(s), 'Let’s plan on Thursday. Don’t confirm anything yet.');
  assert.equal(s.applied.confirmed, false);
  s = run(RR.reduce, [{type: 'SET', group: 'confirmed', value: true}, {type: 'PREVIEW'}, {type: 'APPLY'}], s);
  assert.equal(RR.textOf(s), 'Thursday is confirmed.');
  s = run(RR.reduce, [{type: 'SET', group: 'day', value: 'Friday'}, {type: 'PREVIEW'}, {type: 'APPLY'}], s);
  assert.equal(RR.textOf(s), 'Friday is confirmed, as long as Maya is available.', 'the condition travels with Friday');
});

test('a hand edit survives an unrelated decision change', () => {
  let s = rr('guests', [{type: 'OPEN'}]);
  const before = RR.textOf(s);
  const start = before.indexOf('7:00 p.m.');
  s = RR.reduce(s, {type: 'TEXT_EDIT', before, start, end: start + '7:00 p.m.'.length, removed: '7:00 p.m.', inserted: '7:30 p.m.'});
  s = run(RR.reduce, [{type: 'SET', group: 'guests', key: 'Sam', value: 'excluded'}, {type: 'PREVIEW'}], s);
  assert.deepEqual(s.preview.overwritesEdit, []);
  s = RR.reduce(s, {type: 'APPLY'});
  assert.equal(RR.textOf(s), 'Dinner is at my place on Saturday at 7:30 p.m. Leo is coming. Daniel might join.');
  s = run(RR.reduce, [{type: 'UNDO'}, {type: 'UNDO'}], s);
  assert.equal(RR.textOf(s), before);
});

test('reset returns a scenario to its initial state', () => {
  const s = rr('schedule', [{type: 'OPEN'}, {type: 'SET', group: 'day', value: 'Friday'}, {type: 'PREVIEW'}, {type: 'APPLY'}, {type: 'RESET'}]);
  assert.deepEqual(s, RR.createState('schedule'));
});

/* Evidence records */
test('records: seeds leave unsupplied fields empty and edits round-trip', () => {
  for (const r of REC.SEEDS) { assert.equal(r.output, ''); assert.equal(r.verified, 'no'); }
  let o = REC.setField({}, 'R5', 'output', 'pasted text');
  assert.equal(REC.merge(o).find((r) => r.id === 'R5').output, 'pasted text');
  o = REC.setField(o, 'R5', 'output', '');
  assert.deepEqual(o, {});
  const back = REC.parseOverrides(JSON.stringify(REC.toExport({R1: {said: 'x'}})));
  assert.deepEqual(back, {R1: {said: 'x'}});
  assert.match(REC.toCSV(REC.merge({})), /^id,title,/);
});

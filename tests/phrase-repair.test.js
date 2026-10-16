const test = require('node:test');
const assert = require('node:assert/strict');
const FS = require('../site/assets/fixstrip-core.js');

const run = (actions, state) => actions.reduce((s, a) => FS.reduce(s, a), state);
const load = (id) => {
  const sc = FS.scenarioById(id);
  return {sc, s: FS.reduce(FS.initialState(), {type: 'LOAD', text: sc.text, highlights: sc.highlights})};
};

test('each scenario places its highlight on the right span, one or several words', () => {
  const spans = FS.SCENARIOS.map((sc) => { const {s} = load(sc.id); return s.text.slice(s.highlights[0].start, s.highlights[0].end); });
  assert.deepEqual(spans, ['Risha', 'mobile fix trip', 'Tuesday at three', 'Priya']);
});

test('name: choose an alternative, only the span changes, undo restores exactly', () => {
  let {sc, s} = load('name');
  s = run([{type: 'OPEN_HIGHLIGHT', id: 'h1'}], s);
  assert.equal(s.phase, 'replace');
  assert.deepEqual(FS.alternativesFor(s), ['Rishav', 'Rasha']);
  s = FS.reduce(s, {type: 'CHOOSE', text: 'Rishav'});
  assert.equal(s.phase, 'preview');
  assert.equal(s.text, sc.text, 'preview first, text unchanged');
  s = FS.reduce(s, {type: 'APPLY'});
  assert.equal(s.text, sc.expected);
  assert.equal(s.lastChange.source, 'alternative');
  assert.ok(FS.preservedOutside(s.lastChange.before, s.lastChange.after, s.lastChange.start, s.lastChange.end, s.lastChange.inserted));
  assert.equal(FS.openHighlights(s).length, 0);
  s = FS.reduce(s, {type: 'UNDO'});
  assert.equal(s.text, sc.text);
  assert.equal(FS.openHighlights(s).length, 1, 'undo brings the highlight back too');
});

test('product term: the repeat fills the whole marked span', () => {
  let {sc, s} = load('product');
  s = FS.reduce(s, {type: 'OPEN_HIGHLIGHT', id: 'h1'});
  const said = FS.sayAgainFor(s);
  assert.equal(said, 'Mobile Fix Strip');
  s = run([{type: 'SET_REPLACEMENT', text: said, simulated: true}, {type: 'PREVIEW'}, {type: 'APPLY'}], s);
  assert.equal(s.text, sc.expected);
  assert.equal(s.lastChange.source, 'speech');
});

test('multiple words: repeating “Thursday at two thirty” replaces three words', () => {
  let {sc, s} = load('multi');
  s = run([{type: 'OPEN_HIGHLIGHT', id: 'h1'}], s);
  s = run([{type: 'SET_REPLACEMENT', text: FS.sayAgainFor(s), simulated: true}, {type: 'PREVIEW'}, {type: 'APPLY'}], s);
  assert.equal(s.text, sc.expected);
});

test('false alarm: Keep as written dismisses without changing the message', () => {
  let {sc, s} = load('false-alarm');
  s = run([{type: 'OPEN_HIGHLIGHT', id: 'h1'}, {type: 'DISMISS'}], s);
  assert.equal(s.text, sc.text);
  assert.equal(s.phase, 'idle');
  assert.equal(s.highlights[0].status, 'dismissed');
  assert.equal(s.undo, null, 'nothing to undo: nothing changed');
});

test('highlights are optional: sending works with one still open', () => {
  let {s} = load('name');
  s = FS.reduce(s, {type: 'SEND'});
  assert.equal(s.phase, 'sent');
  assert.equal(s.sent.openHighlights, 1);
});

test('manual selection of any phrase, typed replacement, cancel and reset', () => {
  let {sc, s} = load('false-alarm');
  s = FS.reduce(s, {type: 'OPEN_STRIP'});
  const idx = (w) => FS.dictationTokens(s).findIndex((t) => t.text === w);
  s = run([{type: 'TAP', index: idx('onboarding')}, {type: 'TAP', index: idx('checklist')}, {type: 'START_REPLACE'}], s);
  assert.equal(s.active, null, 'manual selection is not a highlight');
  assert.deepEqual(FS.alternativesFor(s), []);
  s = run([{type: 'SET_REPLACEMENT', text: 'launch plan'}, {type: 'PREVIEW'}], s);
  const cancelled = FS.reduce(s, {type: 'CANCEL'});
  assert.equal(cancelled.text, sc.text);
  s = FS.reduce(s, {type: 'APPLY'});
  assert.equal(s.text, 'Ask Priya to review the launch plan.');
  assert.equal(FS.openHighlights(s).length, 1, 'an unrelated highlight stays open');
  assert.equal(s.highlights[0].start, 4, 'and keeps its position');
  assert.deepEqual(FS.reduce(s, {type: 'RESET'}), FS.initialState());
});

test('selecting exactly a highlighted span manually links it to that highlight', () => {
  let {s} = load('name');
  s = FS.reduce(s, {type: 'OPEN_STRIP'});
  const i = FS.dictationTokens(s).findIndex((t) => t.text === 'Risha');
  s = run([{type: 'TAP', index: i}, {type: 'START_REPLACE'}], s);
  assert.equal(s.active, 'h1');
  assert.equal(FS.sayAgainFor(s), 'Rishav');
});

test('an edit after a highlight shifts it so it still marks the same words', () => {
  let s = FS.reduce(FS.initialState(), {type: 'LOAD', text: 'Hi team, send it to Risha today.', highlights: [{phrase: 'Risha', alternatives: ['Rishav']}]});
  s = FS.reduce(s, {type: 'OPEN_STRIP'});
  s = run([{type: 'TAP', index: FS.dictationTokens(s).findIndex((t) => t.text === 'Hi')}, {type: 'START_REPLACE'}, {type: 'SET_REPLACEMENT', text: 'Hello'}, {type: 'PREVIEW'}, {type: 'APPLY'}], s);
  const h = s.highlights[0];
  assert.equal(s.text.slice(h.start, h.end), 'Risha');
});

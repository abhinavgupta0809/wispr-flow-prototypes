const test = require('node:test');
const assert = require('node:assert/strict');
const FS = require('../site/assets/fixstrip-core.js');

const run = (actions, state = FS.initialState()) => actions.reduce((s, a) => FS.reduce(s, a), state);
const indexOf = (state, word) => FS.dictationTokens(state).findIndex((t) => t.text === word);

function toPreview(word = 'Tuesday', replacement = 'Thursday') {
  let s = run([{type: 'LOAD'}, {type: 'OPEN_STRIP'}]);
  s = run([{type: 'TAP', index: indexOf(s, word)}, {type: 'START_REPLACE'}, {type: 'SET_REPLACEMENT', text: replacement, simulated: true}, {type: 'PREVIEW'}], s);
  return s;
}

test('tokenize keeps every character, in order', () => {
  const tokens = FS.tokenize(FS.PREPARED_DICTATION);
  assert.equal(tokens.map((t) => t.text).join(''), FS.PREPARED_DICTATION);
  assert.ok(tokens.find((t) => t.text === 'Tuesday' && t.word));
  assert.ok(tokens.find((t) => t.text === ', ' && !t.word), 'comma after Tuesday is not part of the word');
});

test('Tuesday becomes Thursday and nothing else changes', () => {
  const s = run([{type: 'APPLY'}], toPreview());
  assert.equal(s.text, 'Send the revised estimate to Maya by Thursday, and keep the implementation details in the appendix.');
  const c = s.lastChange;
  assert.ok(FS.preservedOutside(c.before, c.after, c.start, c.end, c.inserted));
});

test('preview shows the change without touching the text', () => {
  const s = toPreview();
  assert.equal(s.phase, 'preview');
  assert.equal(s.text, FS.PREPARED_DICTATION);
  const p = FS.previewText(s);
  assert.equal(p.removed, 'Tuesday');
  assert.equal(p.inserted, 'Thursday');
  assert.equal(p.before + p.removed + p.after, FS.PREPARED_DICTATION);
});

test('cancel from preview leaves text unchanged and returns to the strip', () => {
  const s = run([{type: 'CANCEL'}], toPreview());
  assert.equal(s.phase, 'strip');
  assert.equal(s.text, FS.PREPARED_DICTATION);
  assert.equal(s.sel, null);
  assert.equal(s.undo, null);
});

test('undo restores the exact original string', () => {
  const s = run([{type: 'APPLY'}, {type: 'UNDO'}], toPreview());
  assert.equal(s.text, FS.PREPARED_DICTATION);
  assert.deepEqual(s.dictation, {start: 0, end: FS.PREPARED_DICTATION.length});
  assert.equal(s.undo, null);
});

test('reset returns to the empty state from anywhere', () => {
  for (const s of [toPreview(), run([{type: 'APPLY'}], toPreview())]) {
    assert.deepEqual(FS.reduce(s, {type: 'RESET'}), FS.initialState());
  }
});

test('multi-word selection extends to a contiguous phrase', () => {
  let s = run([{type: 'LOAD'}, {type: 'OPEN_STRIP'}]);
  s = run([{type: 'TAP', index: indexOf(s, 'implementation')}, {type: 'TAP', index: indexOf(s, 'details')}], s);
  assert.equal(FS.selectionRange(s).phrase, 'implementation details');
  s = run([{type: 'START_REPLACE'}, {type: 'SET_REPLACEMENT', text: 'technical notes'}, {type: 'PREVIEW'}, {type: 'APPLY'}], s);
  assert.equal(s.text, 'Send the revised estimate to Maya by Tuesday, and keep the technical notes in the appendix.');
});

test('tapping punctuation does nothing; tapping a lone selection clears it', () => {
  let s = run([{type: 'LOAD'}, {type: 'OPEN_STRIP'}]);
  const comma = FS.dictationTokens(s).findIndex((t) => !t.word);
  assert.equal(FS.reduce(s, {type: 'TAP', index: comma}).sel, null);
  const i = indexOf(s, 'Maya');
  s = run([{type: 'TAP', index: i}, {type: 'TAP', index: i}], s);
  assert.equal(s.sel, null);
});

test('blank replacement cannot be previewed', () => {
  let s = run([{type: 'LOAD'}, {type: 'OPEN_STRIP'}]);
  s = run([{type: 'TAP', index: indexOf(s, 'Tuesday')}, {type: 'START_REPLACE'}, {type: 'SET_REPLACEMENT', text: '   '}, {type: 'PREVIEW'}], s);
  assert.equal(s.phase, 'replace');
});

test('simulated speech only answers for prepared phrases', () => {
  assert.equal(FS.simulatedReplacementFor('Tuesday'), 'Thursday');
  assert.equal(FS.simulatedReplacementFor('Maya'), null);
  assert.equal(FS.simulatedReplacementFor('constructor'), null);
});

test('actions out of order are ignored', () => {
  const s0 = FS.initialState();
  for (const type of ['OPEN_STRIP', 'START_REPLACE', 'PREVIEW', 'APPLY', 'UNDO', 'CANCEL']) assert.equal(FS.reduce(s0, {type}), s0);
  const loaded = run([{type: 'LOAD'}]);
  assert.equal(FS.reduce(loaded, {type: 'LOAD', text: 'other'}), loaded, 'second load does not overwrite');
});

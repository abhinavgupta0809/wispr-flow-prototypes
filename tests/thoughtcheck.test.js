const test = require('node:test');
const assert = require('node:assert/strict');
const TC = require('../site/assets/thoughtcheck-core.js');

function complete(run, verdicts, extra = {}) {
  run.validity = 'valid';
  run.flowOutput = extra.output || 'pasted output';
  verdicts.forEach((v, i) => { run.assessments[i] = {verdict: v}; });
  Object.assign(run, extra.fields || {});
  return run;
}
const runFor = (ws, id, attempt = 1) => ws.runs.find((r) => r.passageId === id && r.attempt === attempt);

test('workspace has all ten passages, their meaning units, and two brain dumps', () => {
  const ws = TC.createWorkspace();
  assert.equal(TC.PASSAGES.length, 10);
  assert.deepEqual(TC.PASSAGES.map((p) => p.units.length), [5, 3, 4, 4, 4, 4, 4, 4, 8, 8]);
  assert.equal(ws.runs.filter((r) => r.kind === 'controlled').length, 10);
  assert.equal(ws.runs.filter((r) => r.kind === 'spontaneous').length, 2);
  assert.ok(TC.PASSAGES[5].text.includes('Tuesday—sorry, Thursday'));
});

test('a run is complete only with output, a confirmed read, and every unit assessed', () => {
  const ws = TC.createWorkspace();
  const r = runFor(ws, 2);
  assert.equal(TC.runStatus(r), 'not-started');
  r.flowOutput = 'x';
  assert.equal(TC.runStatus(r), 'in-progress');
  r.assessments = {0: {verdict: 'preserved'}, 1: {verdict: 'preserved'}, 2: {verdict: 'omitted'}};
  assert.equal(TC.runStatus(r), 'in-progress', 'read not yet confirmed');
  r.validity = 'valid';
  assert.equal(TC.runStatus(r), 'complete');
  r.validity = 'invalid';
  assert.equal(TC.runStatus(r), 'invalid');
});

test('tallies count the first valid run per passage; invalid runs are kept but excluded', () => {
  const ws = TC.createWorkspace();
  complete(runFor(ws, 1), ['preserved', 'preserved', 'changed', 'preserved', 'preserved']);
  const misread = runFor(ws, 2);
  complete(misread, ['preserved', 'preserved', 'preserved']);
  misread.validity = 'invalid'; misread.invalidReason = 'skipped "today"';
  const redo = TC.newRun(ws, 2, 'redo', misread.id); ws.runs.push(redo);
  complete(redo, ['preserved', 'preserved', 'omitted']);
  const s = TC.summarize(ws).controlled;
  assert.equal(s.primaryRuns, 2);
  assert.equal(s.totals.assessed, 8);
  assert.equal(s.totals.changed, 1);
  assert.equal(s.totals.omitted, 1);
  assert.equal(s.invalid.length, 1);
  assert.ok(ws.runs.includes(misread), 'invalid run preserved');
  assert.deepEqual(s.flagged.map((f) => f.run.id), ['P1-run1', 'P2-run2']);
});

test('recurrence repeats are reported beside the flagged run, not added to totals', () => {
  const ws = TC.createWorkspace();
  const first = complete(runFor(ws, 5), ['preserved', 'preserved', 'omitted', 'preserved']);
  const rep = TC.newRun(ws, 5, 'recurrence', first.id); ws.runs.push(rep);
  complete(rep, ['preserved', 'preserved', 'omitted', 'preserved']);
  const rep2 = TC.newRun(ws, 5, 'recurrence', first.id); ws.runs.push(rep2);
  complete(rep2, ['preserved', 'preserved', 'preserved', 'preserved']);
  const s = TC.summarize(ws).controlled;
  assert.equal(s.totals.assessed, 4);
  assert.equal(s.validComplete, 3);
  assert.equal(s.flagged[0].recurrence, 'recurred');
  assert.deepEqual(s.flagged[0].repeats.map((r) => r.failedAgain.length), [1, 0]);
});

test('unsupported additions flag a run for substantive correction', () => {
  const ws = TC.createWorkspace();
  const r = complete(runFor(ws, 3), ['preserved', 'preserved', 'preserved', 'preserved']);
  assert.equal(TC.tallyRun(r).needsCorrection, false);
  r.additions.push({text: 'Ship to the Boston office first', note: ''});
  assert.equal(TC.tallyRun(r).needsCorrection, true);
  assert.equal(TC.summarize(ws).controlled.totals.additions, 1);
});

test('no pre-cleanup transcript means the discrepancy is end-to-end, whatever was marked', () => {
  const ws = TC.createWorkspace();
  const r = complete(runFor(ws, 7), ['preserved', 'omitted', 'preserved', 'preserved']);
  r.assessments[1].inPreCleanup = 'yes';
  assert.equal(TC.discrepancyStage(r, 1), 'end-to-end');
  r.preCleanup = 'we could launch the beta on monday but that is not a commitment';
  assert.equal(TC.discrepancyStage(r, 1), 'after-transcript');
  r.assessments[1].inPreCleanup = 'no';
  assert.equal(TC.discrepancyStage(r, 1), 'before-cleanup');
});

test('controlled and spontaneous results stay separate', () => {
  const ws = TC.createWorkspace();
  const b = runFor(ws, 'B1');
  b.units = ['Book the venue', 'Budget under 2k'];
  complete(b, ['preserved', 'changed']);
  const s = TC.summarize(ws);
  assert.equal(s.controlled.totals.assessed, 0);
  assert.equal(s.spontaneous.totals.assessed, 2);
  assert.equal(s.spontaneous.flagged.length, 1);
});

test('CSV export escapes text and keeps the actual output verbatim', () => {
  const ws = TC.createWorkspace();
  complete(runFor(ws, 1), ['preserved', 'preserved', 'preserved', 'preserved', 'omitted'], {output: 'Send it, "today"\nthen stop'});
  const csv = TC.toCSV(ws);
  assert.ok(csv.includes('"Send it, ""today""\nthen stop"'));
  assert.ok(csv.startsWith('run_id,kind,passage_id'));
});

test('JSON export round-trips through import', () => {
  const ws = TC.createWorkspace();
  complete(runFor(ws, 4), ['preserved', 'omitted', 'preserved', 'preserved'], {output: 'Give the support team access.'});
  const back = TC.parseImport(JSON.stringify(TC.toExport(ws)));
  assert.deepEqual(back, JSON.parse(JSON.stringify(ws)));
  assert.throws(() => TC.parseImport('{"runs": []}'), /Not a Thought Check/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../site/assets/skills-data.js');
const K = require('../site/assets/skills-core.js');

const accept = (history, id) => history.map((r) => (r.id === id ? {...r, status: 'completed', accepted: true} : r));
const tickAll = (run, n = 40) => { for (let i = 0; i < n && run.phase === 'running'; i++) run = K.reduceRun(run, {type: 'TICK'}); return run; };
const morning = (draft = K.inferDraft(accept(D.HISTORY, 'r3'))) => ({...draft, id: 'morning', command: '/morning'});

test('discovery: retries, cancelled runs and other workflows do not count; the third accepted run triggers the suggestion', () => {
  assert.equal(K.qualifyingRuns(D.HISTORY, 'morning-brief').length, 2);
  assert.equal(K.suggestionState(D.HISTORY, 'morning-brief').show, false);
  const h = accept(D.HISTORY, 'r3');
  assert.deepEqual(K.qualifyingRuns(h, 'morning-brief').map((r) => r.id), ['r1', 'r2', 'r3']);
  assert.equal(K.suggestionState(h, 'morning-brief').show, true);
  assert.equal(K.suggestionState(h, 'morning-brief', {never: true}).show, false);
  assert.equal(K.suggestionState(h, 'morning-brief', {snoozedAt: 3}).show, false, 'Not now waits for another run');
  assert.equal(K.whyNotCounted(D.HISTORY.find((r) => r.id === 'r2b')), 'Retry of an earlier run, not counted');
});

test('draft: dates become a rule to confirm, risky settings are marked inferred, and only uninferable questions are asked', () => {
  const d = K.inferDraft(accept(D.HISTORY, 'r3'));
  assert.equal(d.inputs.window.value, '24h');
  assert.ok(d.inputs.window.inferred && d.destination.inferred && d.completion.inferred);
  assert.deepEqual(d.basedOn, ['r1', 'r2', 'r3']);
  assert.deepEqual(K.setupQuestions(d).map((q) => q.key), ['window', 'threshold']);
  const answered = {...d, inputs: {...d.inputs, window: {...d.inputs.window, value: 'since-last', confirmed: true}}, metrics: {...d.metrics, threshold: 2}};
  assert.deepEqual(K.setupQuestions(answered), []);
});

test('commands: format and clashes', () => {
  assert.equal(K.validateCommand('/morning', K.SAVED).ok, true);
  assert.equal(K.validateCommand('morning', K.SAVED).ok, false);
  assert.equal(K.validateCommand('/inbox', K.SAVED).conflict.id, 'inbox');
  assert.equal(K.validateCommand('/inbox', K.SAVED, 'inbox').ok, true, 'updating the same skill is fine');
  assert.equal(K.spokenForm('/morning'), 'slash morning');
});

test('invocation: only a command at the start triggers; spoken and typed both work', () => {
  const skills = [...K.SAVED, morning()];
  const a = K.parseInvocation('Slash morning, focus on onboarding.', skills);
  assert.equal(a.kind, 'skill'); assert.equal(a.skill.id, 'morning'); assert.equal(a.rest, 'focus on onboarding.'); assert.equal(a.via, 'spoken');
  assert.equal(K.interpret(a.skill, a.rest).inputs.focus, 'onboarding');
  const t = K.parseInvocation('/morning focus on retention', skills);
  assert.equal(t.kind, 'skill'); assert.equal(t.via, 'typed'); assert.equal(K.interpret(t.skill, t.rest).inputs.focus, 'retention');
  assert.equal(K.parseInvocation('I’ll send the morning brief after lunch.', skills).kind, 'text');
  assert.equal(K.parseInvocation('Remind me to say slash morning tomorrow.', skills).kind, 'text', 'mid-sentence never triggers');
  const u = K.parseInvocation('Slash standup, keep it short.', skills);
  assert.equal(u.kind, 'unknown'); assert.equal(u.command, '/standup');
});

test('developer invocation: repo and priority are read; a missing repo is asked for', () => {
  const prs = K.SAVED[0];
  const a = K.parseInvocation('Slash prs for the payments repository. Prioritize anything blocking the release.', K.SAVED);
  const i = K.interpret(a.skill, a.rest);
  assert.deepEqual(i.inputs, {repo: 'payments', priority: 'release blockers first'});
  assert.deepEqual(i.missing, []);
  assert.deepEqual(K.interpret(prs, '').missing, ['repo']);
});

test('run: success path ends Ready for review; posting is explicit and never repeats', () => {
  const skill = morning();
  let r = tickAll(K.createRun(skill, {focus: 'onboarding', window: 'since-last'}, {sections: ['brief']}));
  assert.equal(r.phase, 'ready');
  assert.ok(r.steps.every((s) => s.status === 'done'));
  r = K.reduceRun(r, {type: 'POST', sections: ['brief']});
  assert.equal(r.phase, 'completed');
  const again = K.reduceRun(r, {type: 'POST', sections: ['brief']});
  assert.deepEqual(again.posted, ['brief']);
  assert.equal(again.lastPost.duplicate, true);
});

test('run: an unavailable workbook gives a partial result; retry reruns only what failed and posts nothing again', () => {
  const skill = morning();
  let r = tickAll(K.createRun(skill, {focus: 'onboarding'}, {unavailable: ['excel'], sections: ['feedback', 'metrics']}));
  assert.equal(r.phase, 'partial');
  assert.equal(K.statusLine(r), 'Partially completed');
  assert.equal(r.steps.find((s) => s.id === 'excel').status, 'failed');
  assert.equal(r.steps.find((s) => s.id === 'gmail').status, 'done');
  r = K.reduceRun(r, {type: 'POST', sections: ['feedback']});
  assert.equal(r.phase, 'partial', 'a partial run never reads as complete');
  const gmailAttempts = r.steps.find((s) => s.id === 'gmail').attempts;
  r = tickAll(K.reduceRun(r, {type: 'RETRY', fixed: true}));
  assert.equal(r.steps.find((s) => s.id === 'gmail').attempts, gmailAttempts, 'Gmail did not run again');
  assert.equal(r.steps.find((s) => s.id === 'excel').status, 'done');
  assert.equal(r.phase, 'ready');
  r = K.reduceRun(r, {type: 'POST', sections: ['feedback', 'metrics']});
  assert.deepEqual(r.lastPost.sections, ['metrics'], 'only the new section goes out');
  assert.equal(r.lastPost.reply, true);
  assert.equal(r.phase, 'completed');
});

test('run: changing an input marks finished steps for rerun and leaves upcoming ones to use the new value', () => {
  const skill = morning();
  let r = K.createRun(skill, {focus: 'activation'}, {sections: ['brief']});
  r = ['TICK', 'TICK', 'TICK'].reduce((x, t) => K.reduceRun(x, {type: t}), r); // gmail done, slack running
  r = K.reduceRun(r, {type: 'CHANGE_INPUT', key: 'focus', value: 'retention'});
  const effect = Object.fromEntries(r.impact.map((x) => [x.step, x.effect]));
  assert.deepEqual(effect, {gmail: 'rerun', slack: 'restart', excel: 'upcoming', compare: 'upcoming', draft: 'upcoming'});
  r = tickAll(r);
  assert.equal(r.phase, 'stale');
  r = tickAll(K.reduceRun(r, {type: 'RERUN_STALE'}));
  assert.equal(r.phase, 'ready');
  assert.equal(K.buildBrief(r, D).theme.title, 'Customers asking to pause seats instead of cancelling');
});

test('run: cancel stops pending steps and posts nothing', () => {
  let r = K.createRun(morning(), {focus: 'onboarding'}, {sections: ['brief']});
  r = K.reduceRun(K.reduceRun(r, {type: 'TICK'}), {type: 'CANCEL'});
  assert.equal(r.phase, 'cancelled');
  assert.deepEqual(r.posted, []);
  assert.equal(K.reduceRun(r, {type: 'POST', sections: ['brief']}), r);
});

test('brief: one theme, one flagged metric change kept apart from explanations, one open question', () => {
  const r = tickAll(K.createRun(morning(), {focus: 'onboarding', threshold: 2}, {sections: ['brief']}));
  const b = K.buildBrief(r, D);
  assert.equal(b.theme.title, 'Team invites landing in spam');
  assert.equal(b.theme.emails, 3); assert.equal(b.theme.slack, 2);
  assert.deepEqual(b.metric.map((m) => [m.name, m.delta, m.flagged]), [['7-day onboarding completion', -3.3, true], ['Day-7 activation', -0.4, false]]);
  assert.match(b.question, /invite-source/);
  const partial = K.buildBrief(tickAll(K.createRun(morning(), {focus: 'onboarding'}, {unavailable: ['excel']})), D);
  assert.equal(partial.metric, null);
  assert.deepEqual(partial.missing, ['excel']);
});

test('developer queue: release blockers first, green CI ahead of failing', () => {
  const prs = K.SAVED[0];
  const r = tickAll(K.createRun(prs, {repo: 'payments', priority: 'release blockers first'}));
  assert.deepEqual(K.buildQueue(r, D).map((p) => p.n), [482, 479, 476, 471]);
  assert.equal(r.phase, 'ready');
});

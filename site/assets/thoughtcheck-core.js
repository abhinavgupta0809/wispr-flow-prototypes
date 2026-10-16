/* Research workspace (first built for Thought Check): experiment data, workspace model, tallies and export.
   No DOM, so Node tests can run it. The scripts below are the experimental reference. They are used only to
   assess runs; no prototype interaction reads them. Runs are judged against what was actually said, which
   may differ from the script. */
(function (root) {
  const SCHEMA = 'wfp-thoughtcheck/1';

  const PASSAGES = [
    {id: 1, text: 'Send the revised proposal to Maya by Thursday at three p.m. Keep the implementation details in the appendix, and copy Leo on the email.',
      units: ['Revised proposal', 'Maya', 'Thursday at 3 p.m.', 'Details in appendix', 'Copy Leo']},
    {id: 2, text: 'Do not send the pricing sheet to the client yet. Share the product overview today, but wait for finance approval before sharing any prices.',
      units: ['Withhold pricing', 'Share overview today', 'Finance approval required before prices']},
    {id: 3, text: 'Order eighteen monitors for the New York office and twelve for Boston. Keep the total budget below nine thousand dollars, including delivery.',
      units: ['18 New York', '12 Boston', 'Total below $9,000', 'Delivery included']},
    {id: 4, text: 'Give the whole support team access to the dashboard, except temporary contractors. Contractors should receive a weekly PDF instead, starting next Monday.',
      units: ['Support team access', 'Contractor exception', 'Weekly PDF for contractors', 'Starts next Monday']},
    {id: 5, text: 'Publish the announcement only after legal approves the wording and engineering confirms the migration is complete. If either approval is missing, postpone publication.',
      units: ['Legal wording approval', 'Engineering migration confirmation', 'Both required', 'Postpone if either missing']},
    {id: 6, text: 'Schedule the customer interview for Tuesday—sorry, Thursday—at two p.m. Keep it to thirty minutes, and send the participant the discussion topics beforehand.',
      units: ['Thursday replaces Tuesday', '2 p.m.', '30 minutes', 'Topics sent beforehand'],
      guidance: 'Keeping Thursday and dropping the superseded Tuesday is correct. Mark "Thursday replaces Tuesday" preserved when only Thursday remains.'},
    {id: 7, text: 'We could launch the beta on Monday, but that is not a commitment. Please ask the infrastructure team whether capacity is ready before we choose a launch date.',
      units: ['Monday tentative', 'No commitment', 'Ask infrastructure about capacity', 'Decide date afterward']},
    {id: 8, text: 'Priya owns the onboarding checklist. Daniel owns the billing changes. I will write the launch email, but Priya should review it before it goes out.',
      units: ['Priya onboarding', 'Daniel billing', 'Speaker writes email', 'Priya reviews before sending']},
    {id: 9, text: 'The pilot is for existing customers with fewer than fifty employees. Invite twenty companies initially. Give them two weeks to try the feature, and interview at least five afterward. We are testing whether setup is easier, not whether they want a different pricing plan. Do not expand the pilot until we have reviewed the interviews.',
      units: ['Existing customers', 'Fewer than 50 employees', '20 companies', 'Two weeks', 'At least five interviews', 'Setup research objective', 'Pricing excluded', 'Review before expansion']},
    {id: 10, text: 'For tomorrow’s customer call, start by confirming which workflow is failing. Then ask them to demonstrate it using a sample account. Do not request their password or use production customer data. If the problem cannot be reproduced, collect the app version and approximate failure time, and arrange a follow-up rather than promising a fix date.',
      units: ['Confirm workflow first', 'Demonstration second', 'Sample account', 'No password', 'No production data', 'If unreproduced collect version and time', 'Follow-up', 'No promised fix date']},
  ];

  const SPONTANEOUS = [{id: 'B1', title: 'Brain dump 1'}, {id: 'B2', title: 'Brain dump 2'}];

  const VERDICTS = ['preserved', 'omitted', 'changed', 'unclear'];
  const VERDICT_LABELS = {preserved: 'Preserved', omitted: 'Omitted', changed: 'Changed in meaning', unclear: 'Unclear'};
  const META_FIELDS = [
    ['date', 'Date'], ['device', 'Device'], ['appVersion', 'Flow app version'],
    ['language', 'Language'], ['microphone', 'Microphone'], ['cleanup', 'Cleanup settings'],
  ];
  const PURPOSES = {first: 'First run', redo: 'Redo after misread', recurrence: 'Repeat to check recurrence'};
  /* 'deviated' = I said something other than the script. The run stays valid and is judged against what I said. */
  const VALID = ['valid', 'deviated'];
  const isValid = (run) => VALID.includes(run.validity);
  const SOURCE_VERIFIED = [['no', 'Not yet verified'], ['recording', 'Checked against the recording'], ['transcript', 'Checked against a transcript only']];
  const evidenceDefaults = () => ({actualUtterance: '', intendedChoices: '', correctionWanted: '', sourceVerified: 'no'});

  const emptyMeta = () => Object.fromEntries(META_FIELDS.map(([k]) => [k, '']));

  function newRun(workspace, passageId, purpose = 'first', repeatOf = null) {
    const kind = typeof passageId === 'number' ? 'controlled' : 'spontaneous';
    const attempt = workspace.runs.filter((r) => r.passageId === passageId).length + 1;
    const prior = repeatOf ? workspace.runs.find((r) => r.id === repeatOf) : null;
    const now = new Date().toISOString();
    return {
      id: `${kind === 'controlled' ? 'P' + passageId : passageId}-run${attempt}`,
      kind, passageId, attempt, purpose, repeatOf,
      validity: kind === 'spontaneous' ? 'valid' : 'unconfirmed',
      invalidReason: '',
      meta: {...emptyMeta(), ...workspace.session},
      flowOutput: '', outputLocked: false,
      preCleanup: '',
      recording: {ref: '', fileName: '', hasAudio: false},
      spokenReference: kind === 'spontaneous' && prior ? prior.spokenReference : '',
      units: kind === 'spontaneous' ? (prior ? [...prior.units] : []) : null,
      assessments: {},
      additions: [],
      ...evidenceDefaults(),
      notes: '',
      repeatNeeded: false,
      createdAt: now, updatedAt: now,
    };
  }

  function createWorkspace() {
    const ws = {schema: SCHEMA, createdAt: new Date().toISOString(), session: emptyMeta(), runs: []};
    for (const p of PASSAGES) ws.runs.push(newRun(ws, p.id));
    for (const b of SPONTANEOUS) ws.runs.push(newRun(ws, b.id));
    return ws;
  }

  const passageById = (id) => PASSAGES.find((p) => p.id === id) || null;
  const unitsFor = (run) => (run.kind === 'controlled' ? passageById(run.passageId).units : run.units || []);

  /* A run is complete when it has output, a confirmed read, and a verdict for every meaning unit. */
  function runStatus(run) {
    if (run.validity === 'invalid') return 'invalid';
    const units = unitsFor(run);
    const assessed = units.filter((_, i) => VERDICTS.includes(run.assessments[i]?.verdict)).length;
    const started = run.flowOutput.trim() || assessed > 0 || run.notes.trim();
    if (!started) return 'not-started';
    if (run.flowOutput.trim() && units.length > 0 && assessed === units.length && isValid(run)) return 'complete';
    return 'in-progress';
  }

  function tallyRun(run) {
    const t = {preserved: 0, omitted: 0, changed: 0, unclear: 0, assessed: 0, additions: run.additions.filter((a) => a.text.trim()).length, failedUnits: []};
    unitsFor(run).forEach((unit, i) => {
      const v = run.assessments[i]?.verdict;
      if (!VERDICTS.includes(v)) return;
      t[v] += 1; t.assessed += 1;
      if (v === 'omitted' || v === 'changed') t.failedUnits.push(i);
    });
    t.needsCorrection = t.omitted + t.changed + t.additions > 0;
    return t;
  }

  /* Where a discrepancy happened. Without a pre-cleanup transcript, only "end-to-end" can be said. */
  function discrepancyStage(run, unitIndex) {
    if (!run.preCleanup.trim()) return 'end-to-end';
    const seen = run.assessments[unitIndex]?.inPreCleanup;
    if (seen === 'yes') return 'after-transcript';
    if (seen === 'no') return 'before-cleanup';
    return 'end-to-end';
  }

  function summarizeGroup(runs, primaryOf) {
    const complete = runs.filter((r) => runStatus(r) === 'complete');
    const primary = primaryOf(complete);
    const totals = {preserved: 0, omitted: 0, changed: 0, unclear: 0, assessed: 0, additions: 0};
    const flagged = [];
    for (const run of primary) {
      const t = tallyRun(run);
      for (const k of Object.keys(totals)) totals[k] += t[k];
      if (t.needsCorrection) {
        const repeats = complete.filter((r) => r.purpose === 'recurrence' && r.passageId === run.passageId);
        const recurred = repeats.map((r) => ({id: r.id, failedAgain: tallyRun(r).failedUnits.filter((i) => t.failedUnits.includes(i)), needsCorrection: tallyRun(r).needsCorrection}));
        flagged.push({run, tally: t, repeats: recurred,
          recurrence: recurred.length === 0 ? 'not repeated' : recurred.some((x) => x.failedAgain.length) ? 'recurred' : 'did not recur'});
      }
    }
    return {
      validComplete: complete.length,
      primaryRuns: primary.length,
      totals,
      flagged,
      invalid: runs.filter((r) => r.validity === 'invalid'),
      withPreCleanup: primary.filter((r) => r.preCleanup.trim()).length,
      unclearRuns: primary.filter((r) => tallyRun(r).unclear > 0).map((r) => r.id),
    };
  }

  /* The main pass is one run per passage: the first complete run that is a first run or a redo after a misread.
     Recurrence repeats are reported next to it, never added to the totals. */
  function firstPerPassage(complete) {
    const out = [];
    const seen = new Set();
    for (const r of [...complete].sort((a, b) => a.attempt - b.attempt)) {
      if (r.purpose === 'recurrence' || seen.has(r.passageId)) continue;
      seen.add(r.passageId); out.push(r);
    }
    return out.sort((a, b) => String(a.passageId).localeCompare(String(b.passageId), undefined, {numeric: true}));
  }

  function summarize(ws) {
    return {
      controlled: {...summarizeGroup(ws.runs.filter((r) => r.kind === 'controlled'), firstPerPassage), passagesTotal: PASSAGES.length},
      spontaneous: {...summarizeGroup(ws.runs.filter((r) => r.kind === 'spontaneous'), firstPerPassage), passagesTotal: SPONTANEOUS.length},
    };
  }

  /* Export */
  const csvCell = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  function toCSV(ws) {
    const head = ['run_id', 'kind', 'passage_id', 'attempt', 'purpose', 'repeat_of', 'validity', 'invalid_reason', 'status',
      ...META_FIELDS.map(([k]) => `meta_${k}`), 'has_pre_cleanup', 'recording_ref', 'actual_utterance', 'intended_choices', 'correction_wanted', 'source_verified', 'row_type', 'unit_index', 'unit', 'verdict', 'in_pre_cleanup', 'stage', 'note', 'flow_output'];
    const rows = [head];
    for (const run of ws.runs) {
      const base = [run.id, run.kind, run.passageId, run.attempt, run.purpose, run.repeatOf || '', run.validity, run.invalidReason, runStatus(run),
        ...META_FIELDS.map(([k]) => run.meta[k]), run.preCleanup.trim() ? 'yes' : 'no', run.recording.ref || run.recording.fileName,
        run.actualUtterance || '', run.intendedChoices || '', run.correctionWanted || '', run.sourceVerified || 'no'];
      const units = unitsFor(run);
      units.forEach((unit, i) => {
        const a = run.assessments[i] || {};
        const failed = a.verdict === 'omitted' || a.verdict === 'changed';
        rows.push([...base, 'unit', i + 1, unit, a.verdict || '', a.inPreCleanup || '', failed ? discrepancyStage(run, i) : '', a.note || '', i === 0 ? run.flowOutput : '']);
      });
      run.additions.filter((x) => x.text.trim()).forEach((x, i) => rows.push([...base, 'unsupported_addition', i + 1, x.text, '', '', '', x.note || '', '']));
      if (!units.length) rows.push([...base, 'run', '', '', '', '', '', run.notes, run.flowOutput]);
    }
    return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }

  function toExport(ws) {
    return {schema: SCHEMA, exportedAt: new Date().toISOString(), passages: PASSAGES, spontaneous: SPONTANEOUS, workspace: ws, summary: summaryForExport(summarize(ws))};
  }

  function summaryForExport(s) {
    const slim = (g) => ({
      validComplete: g.validComplete, primaryRuns: g.primaryRuns, totals: g.totals, withPreCleanup: g.withPreCleanup,
      invalidRuns: g.invalid.map((r) => r.id),
      needingSubstantiveCorrection: g.flagged.map((f) => ({run: f.run.id, passage: f.run.passageId, omitted: f.tally.omitted, changed: f.tally.changed, additions: f.tally.additions, recurrence: f.recurrence, repeats: f.repeats})),
    });
    return {note: 'Findings of this small experiment only, not a general error rate. Without a pre-cleanup transcript, discrepancies are end-to-end.', controlled: slim(s.controlled), spontaneous: slim(s.spontaneous)};
  }

  /* Accepts either a full export or a bare workspace. Throws on anything else. */
  function parseImport(text) {
    const data = JSON.parse(text);
    const ws = data && data.workspace ? data.workspace : data;
    if (!ws || ws.schema !== SCHEMA || !Array.isArray(ws.runs)) throw new Error('Not a Thought Check workspace export.');
    for (const r of ws.runs) {
      if (typeof r.id !== 'string' || !('passageId' in r) || typeof r.flowOutput !== 'string' || typeof r.assessments !== 'object') throw new Error(`Run ${r.id || '?'} is malformed.`);
      r.additions = Array.isArray(r.additions) ? r.additions : [];
      r.recording = r.recording || {ref: '', fileName: '', hasAudio: false};
      for (const [k, v] of Object.entries(evidenceDefaults())) if (typeof r[k] !== 'string') r[k] = v;
    }
    ws.session = {...emptyMeta(), ...(ws.session || {})};
    return ws;
  }

  const api = {SCHEMA, PASSAGES, SPONTANEOUS, VERDICTS, VERDICT_LABELS, META_FIELDS, PURPOSES, VALID, isValid, SOURCE_VERIFIED,
    createWorkspace, newRun, passageById, unitsFor, runStatus, tallyRun, discrepancyStage, summarize, toCSV, toExport, parseImport};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ThoughtCheck = api;
})(typeof window !== 'undefined' ? window : globalThis);

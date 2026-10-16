/* Evidence records from my own Flow tests. No DOM, so tests run it in Node.
   Seeds hold only what I have reported so far (Oct 16, 2026). Fields with nothing supplied stay empty:
   none of them is filled in from a script or a guess. Edits made on the page are stored per browser
   and exported with the records. */
(function (root) {
  const SCHEMA = 'wfp-records/1';
  const REPORTED_ON = '2026-10-16';

  const FIELDS = [
    ['said', 'What I actually said', 'From the recording or a transcript of it. Not the prepared script.'],
    ['intended', 'Intended final choices', ''],
    ['output', 'Actual Flow output', 'Pasted exactly, never corrected.'],
    ['reference', 'Recording or transcript reference', 'File name, path or link.'],
    ['correction', 'The correction I wanted to make afterward', ''],
  ];
  const VERIFIED = [['no', 'Not yet verified'], ['recording', 'Checked against the recording'], ['transcript', 'Checked against a transcript only']];

  const SEEDS = [
    {id: 'R1', title: 'Ten controlled passages', informs: 'Background: the original omission test',
      reading: 'The ten controlled passages largely preserved substantive meaning.',
      changed: 'The omitted-ideas check (Thought Check) was replaced by Review Revisions. In these runs, the losses it was meant to catch mostly didn’t appear.',
      said: '', intended: '', output: '', reference: 'Test workspace on this page, if the runs were entered in this browser', correction: '', verified: 'no'},
    {id: 'R2', title: 'Journal comparison', informs: 'Journal Mode',
      reading: 'The journal comparison largely preserved my personality and the story details.',
      changed: 'So Journal Mode is framed as a preference for control, not a fix for lost personality.',
      said: '', intended: '', output: '', reference: '', correction: '', verified: 'no',
      quoted: ['Um, so today—sorry, yesterday, I had a fun day out with my friend…', 'They were like the best damn burgers I’ve ever eaten.']},
    {id: 'R3', title: 'Correction examples', informs: 'Review Revisions',
      reading: 'Several spoken correction examples resolved successfully.',
      changed: 'Review stays optional. Most dictations with a revision come out right, so no confirmation screen.',
      said: '', intended: '', output: '', reference: '', correction: '', verified: 'no'},
    {id: 'R4', title: 'Guest list, first attempt', informs: 'Review Revisions',
      reading: 'Sam appears in the output, and that was intended: I added Sam back on purpose.',
      changed: 'Not an error. Counted as a correct result.',
      said: '', intended: 'Sam back on the list (intentional)', output: '', reference: '', correction: 'None', verified: 'no'},
    {id: 'R5', title: 'Guest list, second attempt', informs: 'Review Revisions, scenario A',
      reading: 'I intended to keep Leo and exclude Sam. The pasted output kept both.',
      changed: 'Basis for scenario A, shown as a reconstruction until the recording is checked.',
      said: '', intended: 'Keep Leo, exclude Sam', output: '', reference: '', correction: 'Remove Sam, keep Leo', verified: 'no'},
    {id: 'R6', title: 'Complex scheduling', informs: 'Review Revisions, scenario B',
      reading: 'The output kept the final date and time, but wrote “the smaller group” without saying who was in it.',
      changed: 'Scenario B names the group explicitly in the final sentence.',
      said: '', intended: '', output: '', reference: '', correction: 'Name the people in “the smaller group”', verified: 'no'},
    {id: 'R7', title: 'Recognition error', informs: 'Phrase Repair, product-term demo',
      reading: 'I said “Mobile Fix Strip.” Flow wrote “mobile fix trip.”',
      changed: 'Basis for Phrase Repair’s product-term demo (it began as the Mobile Fix Strip’s second demo).',
      said: '', intended: 'Mobile Fix Strip', output: '', reference: '', correction: 'Change “fix trip” to “Fix Strip”', verified: 'no'},
  ];

  /* Overrides are only the fields changed on the page, keyed by record id. */
  function merge(overrides) {
    return SEEDS.map((seed) => ({...seed, ...((overrides && overrides[seed.id]) || {})}));
  }

  function setField(overrides, id, field, value) {
    const seed = SEEDS.find((s) => s.id === id);
    if (!seed) return overrides;
    const next = {...(overrides || {})};
    const rec = {...(next[id] || {})};
    if (seed[field] === value) delete rec[field];
    else rec[field] = value;
    if (Object.keys(rec).length) next[id] = rec;
    else delete next[id];
    return next;
  }

  const csvCell = (v) => {
    const s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join(' | ') : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  function toCSV(records) {
    const cols = ['id', 'title', 'informs', 'reading', 'said', 'intended', 'output', 'reference', 'verified', 'correction', 'quoted'];
    return [cols, ...records.map((r) => cols.map((c) => r[c]))].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }

  const toExport = (overrides) => ({schema: SCHEMA, exportedAt: new Date().toISOString(), reportedOn: REPORTED_ON, overrides: overrides || {}, records: merge(overrides)});

  function parseOverrides(text) {
    const data = JSON.parse(text);
    const o = data && data.schema === SCHEMA ? data.overrides : null;
    if (!o || typeof o !== 'object') throw new Error('Not an evidence-records export.');
    return o;
  }

  const api = {SCHEMA, REPORTED_ON, FIELDS, VERIFIED, SEEDS, merge, setField, toCSV, toExport, parseOverrides};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Records = api;
})(typeof window !== 'undefined' ? window : globalThis);

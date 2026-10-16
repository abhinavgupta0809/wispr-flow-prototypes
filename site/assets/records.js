/* Research page: evidence records (records-core.js). Edits save in this browser and export as JSON or CSV. */
(function () {
  const {el, storage, fmtDate} = window.WFP;
  const R = window.Records;
  const KEY = 'wfp-records-v1';
  const $ = (id) => document.getElementById(id);

  let overrides = load();
  let saveTimer = null;

  function load() {
    const raw = storage.get(KEY);
    if (!raw) return {};
    try { return JSON.parse(raw) || {}; } catch { return {}; }
  }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(overrides)); $('records-state').textContent = 'Saved in this browser. Export to keep a copy.'; }
      catch { $('records-state').textContent = 'Could not save in this browser. Export now to keep your edits.'; }
    }, 250);
  }

  function field(rec, key, label, hint) {
    const id = `rec-${rec.id}-${key}`;
    const input = el('textarea', {id, rows: key === 'output' || key === 'said' ? 3 : 2, placeholder: rec[key] ? '' : 'Not supplied yet', spellcheck: key === 'output' ? 'false' : null});
    input.value = rec[key] || '';
    input.addEventListener('input', () => { overrides = R.setField(overrides, rec.id, key, input.value); save(); syncState(rec.id); });
    return el('div', {class: `field-wrap${input.value ? '' : ' empty-field'}`, 'data-field': key}, el('label', {for: id, text: label}), hint ? el('span', {class: 'hint', text: hint}) : null, input);
  }

  function syncState(id) {
    const rec = R.merge(overrides).find((r) => r.id === id);
    const card = $(`record-${id}`);
    if (!card) return;
    const chip = card.querySelector('.verify-chip');
    const label = R.VERIFIED.find(([k]) => k === rec.verified)[1];
    chip.className = `verify-chip ${rec.verified === 'no' ? 'tag tag-unverified' : 'tag tag-finding'}`;
    chip.textContent = label;
    card.querySelectorAll('[data-field]').forEach((w) => w.classList.toggle('empty-field', !w.querySelector('textarea').value));
  }

  function card(rec) {
    const verified = el('select', {'aria-label': `Verification for ${rec.title}`}, ...R.VERIFIED.map(([v, l]) => el('option', {value: v, text: l})));
    verified.value = rec.verified;
    verified.addEventListener('change', () => { overrides = R.setField(overrides, rec.id, 'verified', verified.value); save(); syncState(rec.id); });
    return el('article', {class: 'record block finding', id: `record-${rec.id}`},
      el('div', {class: 'button-row'},
        el('span', {class: 'tag tag-finding', text: 'My test'}),
        el('span', {class: 'verify-chip'}),
        el('span', {class: 'muted', text: `Informs: ${rec.informs}`}),
        el('code', {class: 'record-id', text: rec.id})),
      el('h3', {text: rec.title}),
      el('p', {class: 'record-reading'}, el('span', {class: 'record-label', text: 'My reading, reported ' + fmtDate(R.REPORTED_ON) + ': '}), rec.reading),
      el('p', {class: 'muted'}, el('strong', {text: 'What it changed: '}), rec.changed),
      rec.quoted ? el('div', {class: 'quoted'}, el('span', {class: 'record-label', text: 'Lines quoted in the brief, not yet matched to the recording'}), ...rec.quoted.map((q) => el('blockquote', {text: `“${q}”`}))) : null,
      el('details', {class: 'record-fields', open: rec.id === 'R5' ? true : null},
        el('summary', {text: 'Source fields'}),
        el('div', {class: 'evidence-grid'},
          ...R.FIELDS.map(([k, label, hint]) => field(rec, k, label, hint)),
          el('div', {class: 'field-wrap'}, el('label', {text: 'Source independently verified?'}), el('span', {class: 'hint', text: 'Checked by listening again, or against a separate transcript.'}), verified))));
  }

  function render() {
    const recs = R.merge(overrides);
    const missing = recs.filter((r) => !r.output).length;
    $('records-summary').textContent = `${recs.length} records. ${recs.filter((r) => r.verified !== 'no').length} checked against a source. ${missing} still need the actual Flow output pasted in.`;
    $('records-list').replaceChildren(...recs.map(card));
    recs.forEach((r) => syncState(r.id));
  }

  function download(name, text, type) {
    const a = el('a', {href: URL.createObjectURL(new Blob([text], {type})), download: name});
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  document.addEventListener('DOMContentLoaded', () => {
    render();
    $('records-state').textContent = storage.get(KEY) ? 'Loaded your edits from this browser.' : 'Edits save in this browser as you type.';
    $('records-json').addEventListener('click', () => download(`flow-evidence-records-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(R.toExport(overrides), null, 2), 'application/json'));
    $('records-csv').addEventListener('click', () => download(`flow-evidence-records-${new Date().toISOString().slice(0, 10)}.csv`, R.toCSV(R.merge(overrides)), 'text/csv'));
    $('records-import').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { const next = R.parseOverrides(await f.text()); if (confirm('Replace your record edits in this browser with this file?')) { overrides = next; save(); render(); } }
      catch (err) { alert(`Import failed: ${err.message}`); }
      e.target.value = '';
    });
    $('records-reset').addEventListener('click', () => { if (confirm('Clear your edits and go back to the reported records?')) { overrides = {}; save(); render(); } });
  });
})();

/* Thought Check page: the test workspace (Stage A) and the results view.
   Data model and tallies live in thoughtcheck-core.js. Inputs write straight into the workspace object;
   a card is rebuilt only when its structure changes, so typing never loses focus. */
(function () {
  const {el, quoteCard, storage, fmtDate} = window.WFP;
  const TC = window.ThoughtCheck;
  const E = window.EVIDENCE;
  const KEY = 'wfp-thoughtcheck-v1';
  const $ = (id) => document.getElementById(id);

  let ws = load();
  const ui = {active: {}, open: new Set(), saveTimer: null, view: 'workspace'};

  /* Persistence */
  function load() {
    const raw = storage.get(KEY);
    if (raw) { try { return TC.parseImport(raw); } catch { /* corrupt or old: start fresh, keep the bad copy */ storage.set(`${KEY}-unreadable-${Date.now()}`, raw); } }
    return TC.createWorkspace();
  }
  function save() {
    clearTimeout(ui.saveTimer);
    $('save-state').textContent = 'Saving…';
    ui.saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(ws)); $('save-state').textContent = `Saved in this browser at ${new Date().toLocaleTimeString([], {hour: 'numeric', minute: '2-digit', second: '2-digit'})}. Export to keep a copy.`; }
      catch { $('save-state').textContent = 'Could not save in this browser (storage blocked or full). Export now to keep your work.'; }
    }, 250);
  }
  function touched(run) { run.updatedAt = new Date().toISOString(); save(); refreshStatus(run.passageId); }

  /* Audio attachments: IndexedDB, keyed by run id. Not included in exports. */
  const audioDB = {
    open() {
      return new Promise((resolve, reject) => {
        try {
          const req = indexedDB.open('wfp-thoughtcheck-audio', 1);
          req.onupgradeneeded = () => req.result.createObjectStore('audio');
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        } catch (e) { reject(e); }
      });
    },
    async tx(mode, fn) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const t = db.transaction('audio', mode); const store = t.objectStore('audio');
        const req = fn(store);
        t.oncomplete = () => resolve(req && req.result);
        t.onerror = () => reject(t.error);
      });
    },
    put(id, blob) { return this.tx('readwrite', (s) => s.put(blob, id)); },
    get(id) { return this.tx('readonly', (s) => s.get(id)); },
    del(id) { return this.tx('readwrite', (s) => s.delete(id)); },
    clear() { return this.tx('readwrite', (s) => s.clear()); },
  };

  /* Helpers */
  const runsFor = (pid) => ws.runs.filter((r) => r.passageId === pid).sort((a, b) => a.attempt - b.attempt);
  const activeRun = (pid) => runsFor(pid).find((r) => r.id === ui.active[pid]) || runsFor(pid).at(-1);
  const cardId = (pid) => `card-${pid}`;
  /* Status of the main-pass chain for a passage: the latest run that isn't a recurrence repeat. */
  const mainRun = (pid) => runsFor(pid).filter((r) => r.purpose !== 'recurrence').at(-1);
  function chainLabel(pid) {
    const runs = runsFor(pid);
    const repeats = runs.filter((r) => r.purpose === 'recurrence').length;
    const invalid = runs.filter((r) => r.validity === 'invalid').length;
    return [invalid ? `${invalid} invalid` : '', repeats ? `${repeats} repeat${repeats > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ');
  }
  const STATUS_LABEL = {'not-started': 'Not started', 'in-progress': 'In progress', complete: 'Complete', invalid: 'Invalid'};
  const titleFor = (pid) => (typeof pid === 'number' ? `Passage ${pid}` : TC.SPONTANEOUS.find((b) => b.id === pid).title);
  const allIds = () => [...TC.PASSAGES.map((p) => p.id), ...TC.SPONTANEOUS.map((b) => b.id)];

  function textField(label, value, onInput, opts = {}) {
    const id = `f-${Math.random().toString(36).slice(2, 9)}`;
    const input = opts.multiline ? el('textarea', {id, rows: opts.rows || 3, placeholder: opts.placeholder || '', readonly: opts.readonly || null, spellcheck: opts.spellcheck ?? null}) : el('input', {id, type: opts.type || 'text', placeholder: opts.placeholder || ''});
    input.value = value || '';
    input.addEventListener('input', () => onInput(input.value));
    return el('div', {class: `field-wrap ${opts.class || ''}`}, el('label', {for: id, text: label}), opts.hint ? el('span', {class: 'hint', text: opts.hint}) : null, input);
  }

  /* Session conditions */
  function renderSession() {
    $('session-form').replaceChildren(...TC.META_FIELDS.map(([k, label]) => textField(label, ws.session[k], (v) => { ws.session[k] = v; save(); }, {type: k === 'date' ? 'date' : 'text', placeholder: placeholderFor(k)})));
  }
  function placeholderFor(k) {
    return {device: 'e.g. iPhone 16, iOS 27.0.1', appVersion: 'from Flow settings', language: 'e.g. English (US)', microphone: 'e.g. built-in, AirPods Pro 2', cleanup: 'e.g. Auto Cleanup: Light; Styles off'}[k] || '';
  }

  /* Index chips */
  function renderIndex() {
    $('run-index').replaceChildren(...allIds().map((pid) => {
      const status = TC.runStatus(mainRun(pid));
      const extra = chainLabel(pid);
      return el('a', {href: `#${cardId(pid)}`, class: `chip s-${status}`, onclick: (e) => { e.preventDefault(); openCard(pid); }},
        el('strong', {text: String(pid)}), el('span', {text: STATUS_LABEL[status]}), extra ? el('span', {class: 'runs', text: extra}) : null);
    }));
  }

  function openCard(pid) {
    ui.open.add(pid);
    const card = $(cardId(pid));
    card.open = true;
    card.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
  }

  function refreshStatus(pid) {
    renderIndex();
    refreshCard(pid);
    if (ui.view === 'results') renderResults();
  }

  function refreshCard(pid) {
    const card = $(cardId(pid));
    if (card) {
      const run = activeRun(pid);
      const main = TC.runStatus(mainRun(pid));
      const chip = card.querySelector('.card-status');
      chip.className = `card-status s-${main}`; chip.textContent = STATUS_LABEL[main];
      const runChip = card.querySelector('.run-status');
      const status = TC.runStatus(run);
      runChip.className = `run-status card-status s-${status}`; runChip.textContent = `This run: ${STATUS_LABEL[status]}`;
      const t = TC.tallyRun(run);
      const tally = card.querySelector('.run-tally');
      if (tally) tally.textContent = `${t.assessed} of ${TC.unitsFor(run).length} units assessed · ${t.omitted} omitted · ${t.changed} changed · ${t.unclear} unclear · ${t.additions} unsupported additions`;
      card.querySelectorAll('[data-needs]').forEach((b) => { b.disabled = !needsCheck(run, b.dataset.needs); });
    }
  }

  function needsCheck(run, kind) {
    if (kind === 'redo') return run.validity === 'invalid';
    if (kind === 'recurrence') return TC.runStatus(run) === 'complete' && (TC.tallyRun(run).needsCorrection || run.repeatNeeded);
    return true;
  }

  /* Cards */
  function renderCards() {
    $('cards').replaceChildren(...allIds().map(buildCard));
    allIds().forEach(refreshCard);
  }

  function rebuildCard(pid) {
    const old = $(cardId(pid));
    const fresh = buildCard(pid);
    old.replaceWith(fresh);
    refreshStatus(pid);
  }

  function buildCard(pid) {
    const run = activeRun(pid);
    const status = TC.runStatus(mainRun(pid));
    const passage = typeof pid === 'number' ? TC.passageById(pid) : null;
    const details = el('details', {class: `card ${passage ? 'controlled' : 'spontaneous'}`, id: cardId(pid), open: ui.open.has(pid)});
    details.addEventListener('toggle', () => { if (details.open) ui.open.add(pid); else ui.open.delete(pid); });
    details.append(el('summary', {},
      el('span', {class: 'card-title'}, el('strong', {text: titleFor(pid)}), el('span', {class: 'card-sub', text: [passage ? `${passage.units.length} meaning units` : 'Unscripted, exploratory', chainLabel(pid)].filter(Boolean).join(' · ')})),
      el('span', {class: `card-status s-${status}`, text: STATUS_LABEL[status]})));

    const body = el('div', {class: 'card-body'});
    if (passage) {
      const copy = el('button', {type: 'button', class: 'button small quiet', text: 'Copy script'});
      copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(passage.text); copy.textContent = 'Copied'; } catch { copy.textContent = 'Copy failed: select the text'; } setTimeout(() => { copy.textContent = 'Copy script'; }, 1500); });
      body.append(el('div', {class: 'script'},
        el('div', {class: 'script-head'}, el('span', {class: 'eyebrow', text: 'Read aloud, verbatim'}), copy),
        el('p', {class: 'script-text', text: passage.text}),
        passage.guidance ? el('p', {class: 'muted', text: passage.guidance}) : null));
    } else {
      body.append(el('p', {class: 'muted', text: 'Speak freely for 30 to 90 seconds about something real, like planning a trip or a work update. Afterwards, listen to the recording, write what you said, and list its meaning units. Assess Flow\'s output against the recording.'}));
    }

    const runs = runsFor(pid);
    if (runs.length > 1) {
      body.append(el('div', {class: 'run-tabs', role: 'group', 'aria-label': 'Runs'}, ...runs.map((r) => el('button', {
        type: 'button', class: 'run-tab', 'aria-pressed': r.id === run.id ? 'true' : 'false', onclick: () => { ui.active[pid] = r.id; rebuildCard(pid); },
      }, `Run ${r.attempt}`, el('span', {text: ` · ${TC.PURPOSES[r.purpose]}${r.validity === 'invalid' ? ' · invalid' : ''}`})))));
    }
    body.append(buildRun(run, passage));
    details.append(body);
    return details;
  }

  function buildRun(run, passage) {
    const wrap = el('div', {class: 'run'});
    const head = el('div', {class: 'run-head'},
      el('h3', {text: `Run ${run.attempt}: ${TC.PURPOSES[run.purpose]}`}),
      run.repeatOf ? el('span', {class: 'muted', text: `repeats ${run.repeatOf}`}) : null,
      el('span', {class: 'run-status card-status'}),
      el('code', {class: 'run-id', text: run.id}));
    wrap.append(head);

    /* Read validity */
    if (passage) {
      const name = `valid-${run.id}`;
      const opt = (value, label) => {
        const input = el('input', {type: 'radio', name, value, checked: run.validity === value});
        input.addEventListener('change', () => { run.validity = value; touched(run); reason.hidden = value !== 'invalid'; });
        return el('label', {class: 'pill'}, input, el('span', {text: label}));
      };
      const reason = textField('What was misread', run.invalidReason, (v) => { run.invalidReason = v; touched(run); }, {placeholder: 'e.g. said "Wednesday" instead of "Thursday"'});
      reason.hidden = run.validity !== 'invalid';
      wrap.append(el('fieldset', {class: 'validity'}, el('legend', {text: 'Did you read the script exactly?'}),
        el('div', {class: 'pills'}, opt('unconfirmed', 'Not confirmed'), opt('valid', 'Read as written'), opt('invalid', 'Misread: run invalid')), reason));
    } else {
      const box = el('input', {type: 'checkbox', checked: run.validity === 'invalid'});
      box.addEventListener('change', () => { run.validity = box.checked ? 'invalid' : 'valid'; touched(run); });
      wrap.append(el('label', {class: 'inline-check'}, box, ' Mark this run invalid (for example, the recording failed)'));
    }

    /* Metadata */
    wrap.append(el('details', {class: 'meta-details', open: !run.meta.device && !ws.session.device ? true : null},
      el('summary', {text: `Test conditions: ${[run.meta.date && fmtDate(run.meta.date), run.meta.device, run.meta.appVersion && `app ${run.meta.appVersion}`, run.meta.cleanup].filter(Boolean).join(' · ') || 'not set'}`}),
      el('div', {class: 'meta-grid'}, ...TC.META_FIELDS.map(([k, label]) => textField(label, run.meta[k], (v) => { run.meta[k] = v; touched(run); }, {type: k === 'date' ? 'date' : 'text', placeholder: placeholderFor(k)})))));

    /* Spontaneous reference */
    if (!passage) {
      wrap.append(textField('What you said, from the recording', run.spokenReference, (v) => { run.spokenReference = v; touched(run); }, {multiline: true, rows: 4, hint: 'Your own transcription of the audio. This is the reference for this run.'}));
      const unitsBox = textField('Meaning units, one per line', run.units.join('\n'), () => {}, {multiline: true, rows: 4, hint: 'List what must survive: who, what, when, conditions, exclusions. Assessments follow the unit text if you reorder.'});
      unitsBox.querySelector('textarea').addEventListener('change', (e) => {
        const next = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
        const old = run.units; const assess = {};
        next.forEach((u, i) => { const j = old.indexOf(u); if (j >= 0 && run.assessments[j]) assess[i] = run.assessments[j]; });
        run.units = next; run.assessments = assess; touched(run); rebuildCard(run.passageId);
      });
      wrap.append(unitsBox);
    }

    /* Outputs */
    const outBox = textField('Actual Flow output', run.flowOutput, (v) => { if (!run.outputLocked) { run.flowOutput = v; touched(run); } }, {multiline: true, rows: 4, readonly: run.outputLocked, spellcheck: 'false', hint: 'Paste exactly what Flow produced. Never edit it to fix mistakes.', class: run.outputLocked ? 'locked' : ''});
    const lock = el('button', {type: 'button', class: 'button small', text: run.outputLocked ? 'Unlock to correct a paste error' : 'Lock output'});
    lock.addEventListener('click', () => {
      if (run.outputLocked && !confirm('Unlock the actual output? Only do this to fix a paste mistake, never to edit what Flow produced.')) return;
      run.outputLocked = !run.outputLocked; touched(run); rebuildCard(run.passageId);
    });
    outBox.append(el('div', {class: 'button-row'}, lock, run.outputLocked ? el('span', {class: 'muted', text: 'Locked. This text is the preserved actual output.'}) : null));
    wrap.append(outBox);
    const pre = textField('Pre-cleanup transcript (optional)', run.preCleanup, (v) => { run.preCleanup = v; touched(run); rebuildPreCleanupHints(wrap, run); }, {multiline: true, rows: 3, spellcheck: 'false', hint: 'Only if Flow shows the raw transcript separately. Without it, any discrepancy is labeled end-to-end.'});
    wrap.append(pre);

    /* Recording */
    wrap.append(buildRecording(run));

    /* Assessment */
    const units = TC.unitsFor(run);
    const table = el('div', {class: 'assess'});
    if (!units.length) table.append(el('p', {class: 'muted', text: 'Add meaning units above to assess this run.'}));
    units.forEach((unit, i) => table.append(buildUnitRow(run, unit, i)));
    wrap.append(el('fieldset', {class: 'assess-wrap'}, el('legend', {text: 'Meaning units'}),
      el('p', {class: 'muted', text: 'Preserved: the meaning survives, even if worded differently. Changed in meaning: present but now says something else. Unclear: you can\'t tell.'}),
      table, el('p', {class: 'run-tally muted'})));

    /* Additions */
    wrap.append(buildAdditions(run));

    /* Notes and repeats */
    wrap.append(textField('Notes', run.notes, (v) => { run.notes = v; touched(run); }, {multiline: true, rows: 2}));
    const rep = el('input', {type: 'checkbox', checked: run.repeatNeeded});
    rep.addEventListener('change', () => { run.repeatNeeded = rep.checked; touched(run); });
    const addRun = (purpose) => {
      const fresh = TC.newRun(ws, run.passageId, purpose, run.id);
      fresh.meta = {...run.meta, date: ''};
      ws.runs.push(fresh); ui.active[run.passageId] = fresh.id; save(); rebuildCard(run.passageId);
    };
    wrap.append(el('div', {class: 'repeat'},
      el('label', {class: 'inline-check'}, rep, ' Repeat test needed'),
      el('div', {class: 'button-row'},
        passage ? el('button', {type: 'button', class: 'button small', 'data-needs': 'redo', disabled: !needsCheck(run, 'redo'), onclick: () => addRun('redo'), text: 'Add redo (after a misread)'}) : null,
        el('button', {type: 'button', class: 'button small', 'data-needs': 'recurrence', disabled: !needsCheck(run, 'recurrence'), onclick: () => addRun('recurrence'), text: 'Add repeat (check recurrence)'}))));
    return wrap;
  }

  function buildUnitRow(run, unit, i) {
    const a = run.assessments[i] || {};
    const name = `u-${run.id}-${i}`;
    const row = el('div', {class: 'unit-row'});
    const pills = el('div', {class: 'pills verdicts', role: 'radiogroup', 'aria-label': `Assessment for ${unit}`}, ...TC.VERDICTS.map((v) => {
      const input = el('input', {type: 'radio', name, value: v, checked: a.verdict === v});
      input.addEventListener('change', () => {
        run.assessments[i] = {...(run.assessments[i] || {}), verdict: v};
        touched(run); syncPreHint(row, run, i);
      });
      return el('label', {class: `pill v-${v}`}, input, el('span', {text: TC.VERDICT_LABELS[v]}));
    }));
    const note = el('input', {type: 'text', placeholder: 'What Flow wrote instead (optional)', 'aria-label': `Note for ${unit}`});
    note.value = a.note || '';
    note.addEventListener('input', () => { run.assessments[i] = {...(run.assessments[i] || {}), note: note.value}; touched(run); });
    const preSel = el('select', {'aria-label': `Is "${unit}" in the pre-cleanup transcript?`},
      ...[['', 'In the pre-cleanup transcript?'], ['yes', 'Yes: lost after the transcript'], ['no', 'No: missing from the transcript too'], ['unsure', 'Can\'t tell']].map(([v, l]) => el('option', {value: v, text: l})));
    preSel.value = a.inPreCleanup || '';
    preSel.addEventListener('change', () => { run.assessments[i] = {...(run.assessments[i] || {}), inPreCleanup: preSel.value}; touched(run); });
    row.append(el('div', {class: 'unit-name'}, el('span', {class: 'unit-n', text: i + 1}), el('span', {text: unit})), pills, el('div', {class: 'unit-extra'}, note, preSel));
    syncPreHint(row, run, i);
    return row;
  }

  function syncPreHint(row, run, i) {
    const v = run.assessments[i]?.verdict;
    row.querySelector('select').hidden = !(run.preCleanup.trim() && (v === 'omitted' || v === 'changed'));
  }
  function rebuildPreCleanupHints(wrap, run) {
    wrap.querySelectorAll('.unit-row').forEach((row, i) => syncPreHint(row, run, i));
  }

  function buildAdditions(run) {
    const list = el('div', {class: 'additions'});
    const draw = () => {
      list.replaceChildren(...run.additions.map((x, i) => {
        const text = el('input', {type: 'text', placeholder: 'Text Flow added that you never said', 'aria-label': `Unsupported addition ${i + 1}`});
        text.value = x.text;
        text.addEventListener('input', () => { x.text = text.value; touched(run); });
        const note = el('input', {type: 'text', placeholder: 'Does it change the meaning? (optional)', 'aria-label': `Note for addition ${i + 1}`});
        note.value = x.note || '';
        note.addEventListener('input', () => { x.note = note.value; touched(run); });
        return el('div', {class: 'addition-row'}, text, note, el('button', {type: 'button', class: 'button small quiet', 'aria-label': `Remove addition ${i + 1}`, onclick: () => { run.additions.splice(i, 1); touched(run); draw(); }, text: 'Remove'}));
      }));
    };
    draw();
    return el('fieldset', {class: 'assess-wrap'}, el('legend', {text: 'Unsupported additions'}),
      el('p', {class: 'muted', text: 'Content in the output that was never said: a new instruction, name, number or condition. Punctuation and formatting don\'t count.'}),
      list, el('div', {class: 'button-row'}, el('button', {type: 'button', class: 'button small', onclick: () => { run.additions.push({text: '', note: ''}); save(); draw(); list.querySelector('.addition-row:last-child input')?.focus(); }, text: '+ Add an unsupported addition'})));
  }

  function buildRecording(run) {
    const box = el('div', {class: 'field-wrap recording'});
    const refField = textField('Recording reference', run.recording.ref, (v) => { run.recording.ref = v; touched(run); }, {placeholder: 'File name, path or link, e.g. P3-run1.m4a'});
    const file = el('input', {type: 'file', accept: 'audio/*,video/*', class: 'sr-only', id: `file-${run.id}`});
    const status = el('span', {class: 'muted'});
    const player = el('div', {class: 'player'});
    const drawPlayer = async () => {
      player.replaceChildren();
      if (!run.recording.hasAudio) { status.textContent = run.recording.fileName ? `Noted: ${run.recording.fileName} (audio not stored here)` : 'No audio attached.'; return; }
      try {
        const blob = await audioDB.get(run.id);
        if (!blob) { status.textContent = `Audio for ${run.recording.fileName} is not in this browser. Reattach it to play.`; return; }
        status.textContent = `${run.recording.fileName} · stored in this browser only`;
        player.append(el('audio', {controls: true, preload: 'metadata', src: URL.createObjectURL(blob)}),
          el('button', {type: 'button', class: 'button small quiet', text: 'Remove audio', onclick: async () => { try { await audioDB.del(run.id); } catch { /* already gone */ } run.recording.hasAudio = false; touched(run); drawPlayer(); }}));
      } catch { status.textContent = 'This browser can\'t store audio here. Keep the file and use the reference field.'; }
    };
    file.addEventListener('change', async () => {
      const f = file.files[0];
      if (!f) return;
      run.recording.fileName = f.name;
      if (!run.recording.ref) { run.recording.ref = f.name; refField.querySelector('input').value = f.name; }
      try { await audioDB.put(run.id, f); run.recording.hasAudio = true; } catch { run.recording.hasAudio = false; }
      touched(run); drawPlayer();
    });
    box.append(refField, el('div', {class: 'button-row'}, el('label', {class: 'button small', for: file.id, text: 'Attach audio'}), file, status), player);
    drawPlayer();
    return box;
  }

  /* Results */
  function statTile(label, value, sub) {
    return el('div', {class: 'stat'}, el('span', {class: 'stat-label', text: label}), el('strong', {class: 'stat-value', text: value}), sub ? el('span', {class: 'stat-sub', text: sub}) : null);
  }

  const STAGE_LABEL = {'end-to-end': 'End-to-end discrepancy', 'after-transcript': 'In the pre-cleanup transcript, lost after it', 'before-cleanup': 'Missing from the pre-cleanup transcript too'};

  function groupResults(title, g, isControlled) {
    const units = (r) => TC.unitsFor(r);
    const section = el('section', {class: 'result-group'});
    section.append(el('div', {class: 'section-head'},
      el('div', {class: 'button-row'}, el('span', {class: 'tag tag-finding', text: 'Experiment finding'}), isControlled ? null : el('span', {class: 'tag tag-hypothesis', text: 'Exploratory'})),
      el('h3', {class: 'result-title', text: title}),
      el('p', {class: 'muted', text: isControlled
        ? `The main pass counts one valid run per passage. Repeats appear beside a flagged passage and are not added to the totals.`
        : 'Unscripted and assessed against the recordings. Kept apart from the controlled runs.'})));
    if (!g.primaryRuns) {
      section.append(el('p', {class: 'empty', text: isControlled ? 'No completed runs yet. A run counts once it has the actual output, a confirmed read, and every meaning unit marked.' : 'No completed brain dumps yet.'}));
      if (g.invalid.length) section.append(invalidList(g));
      return section;
    }
    const tot = g.totals;
    section.append(el('div', {class: 'stats'},
      statTile('Valid runs completed', `${g.validComplete}`, isControlled ? `${g.primaryRuns} of ${g.passagesTotal} passages in the main pass` : `${g.primaryRuns} of ${g.passagesTotal} brain dumps`),
      statTile('Meaning units assessed', `${tot.assessed}`, `in the main pass`),
      statTile('Preserved', `${tot.preserved}`), statTile('Omitted', `${tot.omitted}`), statTile('Changed in meaning', `${tot.changed}`), statTile('Unclear', `${tot.unclear}`),
      statTile('Unsupported additions', `${tot.additions}`),
      statTile('Needing substantive correction', `${g.flagged.length}`, `of ${g.primaryRuns} ${isControlled ? 'passages' : 'brain dumps'}`)));

    section.append(el('p', {class: 'muted caveat', text: `These are findings from this small experiment: one speaker, ${g.primaryRuns} ${isControlled ? (g.primaryRuns === 1 ? 'scripted passage' : 'scripted passages') : (g.primaryRuns === 1 ? 'brain dump' : 'brain dumps')}, the conditions recorded on each run. They are not Flow's general error rate. ${g.withPreCleanup ? `${g.withPreCleanup} of ${g.primaryRuns} runs have a pre-cleanup transcript.` : 'No run has a pre-cleanup transcript, so every discrepancy is end-to-end: it could come from capture, recognition or cleanup.'}`}));

    if (g.flagged.length) {
      section.append(el('h4', {text: isControlled ? 'Passages requiring substantive correction' : 'Brain dumps requiring substantive correction'}));
      section.append(el('div', {class: 'flagged'}, ...g.flagged.map((f) => {
        const u = units(f.run);
        const items = [];
        u.forEach((name, i) => {
          const a = f.run.assessments[i];
          if (a && (a.verdict === 'omitted' || a.verdict === 'changed')) items.push(el('li', {}, el('strong', {text: `${TC.VERDICT_LABELS[a.verdict]}: `}), name, a.note ? el('span', {class: 'muted', text: ` (Flow: “${a.note}”)`}) : null, el('span', {class: 'stage', text: STAGE_LABEL[TC.discrepancyStage(f.run, i)]})));
        });
        f.run.additions.filter((x) => x.text.trim()).forEach((x) => items.push(el('li', {}, el('strong', {text: 'Unsupported addition: '}), `“${x.text}”`, x.note ? el('span', {class: 'muted', text: ` (${x.note})`}) : null)));
        const rec = {recurred: 'Recurred on repeat', 'did not recur': 'Did not recur on repeat', 'not repeated': 'Not repeated yet'}[f.recurrence];
        return el('article', {class: 'block finding'},
          el('div', {class: 'button-row'}, el('strong', {text: titleFor(f.run.passageId)}), el('code', {text: f.run.id}), el('span', {class: `rec rec-${f.recurrence.replace(/\s/g, '-')}`, text: rec})),
          el('ul', {class: 'ticks'}, ...items),
          f.repeats.length ? el('p', {class: 'muted', text: f.repeats.map((r) => `${r.id}: ${r.failedAgain.length ? `same unit failed again (${r.failedAgain.map((i) => u[i]).join(', ')})` : r.needsCorrection ? 'different problem' : 'no problem'}`).join(' · ')}) : null,
          el('details', {}, el('summary', {text: 'Actual Flow output'}), el('p', {class: 'verbatim', text: f.run.flowOutput})));
      })));
    } else {
      section.append(el('p', {class: 'muted', text: `No ${isControlled ? 'passage' : 'brain dump'} in the main pass needed substantive correction.`}));
    }
    if (g.unclearRuns.length) section.append(el('p', {class: 'muted', text: `Runs with units marked unclear: ${g.unclearRuns.join(', ')}. Listen to the recording again before reporting them.`}));
    if (g.invalid.length) section.append(invalidList(g));
    return section;
  }

  function invalidList(g) {
    return el('details', {class: 'invalid-list'}, el('summary', {text: `${g.invalid.length} invalid run${g.invalid.length > 1 ? 's' : ''}, kept for transparency`}),
      el('ul', {class: 'ticks'}, ...g.invalid.map((r) => el('li', {}, el('code', {text: r.id}), r.invalidReason ? `: ${r.invalidReason}` : ''))));
  }

  function renderResults() {
    const s = TC.summarize(ws);
    $('view-results').replaceChildren(
      groupResults('Controlled runs: ten scripted passages', s.controlled, true),
      groupResults('Spontaneous runs: two brain dumps', s.spontaneous, false),
      el('div', {class: 'button-row'}, el('button', {type: 'button', class: 'button small', onclick: exportJSON, text: 'Export JSON (includes this summary)'}), el('button', {type: 'button', class: 'button small', onclick: exportCSV, text: 'Export CSV'})));
  }

  /* Tabs */
  function setView(view, push = true) {
    ui.view = view;
    for (const v of ['workspace', 'results', 'proposal']) {
      $(`tab-${v}`).setAttribute('aria-selected', String(v === view));
      $(`view-${v}`).hidden = v !== view;
    }
    if (view === 'results') renderResults();
    if (push) history.replaceState(null, '', view === 'workspace' ? location.pathname : `#${view}`);
  }

  /* Export / import */
  function download(name, text, type) {
    const a = el('a', {href: URL.createObjectURL(new Blob([text], {type})), download: name});
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  function exportJSON() { download(`thought-check-${stamp()}.json`, JSON.stringify(TC.toExport(ws), null, 2), 'application/json'); }
  function exportCSV() { download(`thought-check-${stamp()}.csv`, TC.toCSV(ws), 'text/csv'); }

  function wireToolbar() {
    $('export-json').addEventListener('click', exportJSON);
    $('export-csv').addEventListener('click', exportCSV);
    $('import-json').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const next = TC.parseImport(await f.text());
        if (!confirm('Replace the current workspace with this file? Export first if you want to keep the current one.')) return;
        ws = next; save(); renderAll();
      } catch (err) { alert(`Import failed: ${err.message}`); }
      e.target.value = '';
    });
    $('reset-ws').addEventListener('click', async () => {
      if (!confirm('Erase every run, assessment and attached audio in this browser? Export first to keep a copy.')) return;
      ws = TC.createWorkspace(); ui.active = {}; ui.open.clear();
      try { await audioDB.clear(); } catch { /* nothing stored */ }
      save(); renderAll();
    });
    $('session-apply').addEventListener('click', () => {
      let n = 0;
      for (const r of ws.runs) for (const [k] of TC.META_FIELDS) if (!r.meta[k] && ws.session[k]) { r.meta[k] = ws.session[k]; n += 1; }
      save(); renderCards(); renderIndex();
      $('save-state').textContent = `Filled ${n} empty field${n === 1 ? '' : 's'}.`;
    });
    for (const v of ['workspace', 'results', 'proposal']) $(`tab-${v}`).addEventListener('click', () => setView(v));
    $('tabs').querySelector('[role=tablist]').addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const order = ['workspace', 'results', 'proposal'];
      const next = order[(order.indexOf(ui.view) + (e.key === 'ArrowRight' ? 1 : 2)) % 3];
      setView(next); $(`tab-${next}`).focus();
    });
  }

  /* Static evidence */
  function renderStatic() {
    $('tc-evidence').replaceChildren(...E.thoughtCheck.map(quoteCard));
    const d = E.docs;
    const doc = (title, quote, note, src) => el('article', {class: 'block shipping'},
      el('div', {class: 'button-row'}, el('span', {class: 'tag tag-shipping', text: 'Wispr docs'}), el('span', {class: 'muted', text: `read ${fmtDate(d.readOn)}`})),
      el('h3', {text: title}), quote ? el('blockquote', {class: 'doc-quote', text: `“${quote}”`}) : null,
      el('p', {class: 'muted'}, note, ' Source: ', el('a', {href: src.url, target: '_blank', rel: 'noopener', text: src.title})));
    $('tc-docs').replaceChildren(
      doc('Desktop: the pre-cleanup text is kept', d.autoCleanup.quote, d.autoCleanup.note, d.autoCleanup),
      doc('iPhone: audio can be retained for a while', null, d.navigating.note, d.navigating),
      el('article', {class: 'block', style: 'grid-column: 1 / -1'},
        el('div', {class: 'button-row'}, el('span', {class: 'tag tag-hypothesis', text: 'Hypothesis'})),
        el('p', {}, 'Showing every edit is not the same as pointing at the one that matters. In a cleaned draft, a dropped condition ("wait for finance approval") reads fluently, so a person skimming may not notice it is gone. This experiment checks first whether that happens with the real app, before any interaction is designed around it.')));
  }

  function renderAll() { renderSession(); renderIndex(); renderCards(); if (ui.view === 'results') renderResults(); }

  document.addEventListener('DOMContentLoaded', () => {
    renderStatic(); wireToolbar(); renderAll();
    const initial = location.hash.slice(1);
    setView(['results', 'proposal'].includes(initial) ? initial : 'workspace', false);
    $('save-state').textContent = storage.get(KEY) ? 'Loaded your saved workspace from this browser.' : 'New workspace. Your entries save in this browser as you type.';
    try { navigator.storage?.persist?.(); } catch { /* best effort */ }
  });
})();

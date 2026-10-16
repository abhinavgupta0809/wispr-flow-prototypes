/* Journal Mode page. State goes through JournalMode.reduce (journal-core.js); phrase edits use the shared
   phrase editor (phrase-editor.js). Nothing is recorded: Stop inserts a prepared entry. */
(function () {
  const {el, storage, fmtDate} = window.WFP;
  const JM = window.JournalMode;
  const TD = window.TextDiff;
  const E = window.EVIDENCE;
  const $ = (id) => document.getElementById(id);
  const WINDOW_KEY = 'wfp-journal-press-ms';

  let state = JM.initialState();
  const ui = {windowMs: Number(storage.get(WINDOW_KEY)) || JM.DEFAULT_PRESS_WINDOW_MS, editing: null, toast: null, flash: null, startedAt: 0, tick: null, pressFlash: null};
  let ed;

  function dispatch(action) {
    const prev = state;
    state = JM.reduce(state, action);
    if (state === prev) { if (action.type === 'PRESS') renderPresses(); return; }
    if (action.type === 'START_RECORDING') { ui.startedAt = Date.now(); clearInterval(ui.tick); ui.tick = setInterval(renderStatus, 250); }
    if (action.type === 'STOP_RECORDING' || action.type === 'RESET') { clearInterval(ui.tick); ui.tick = null; }
    if (action.type === 'RESET') { ui.editing = null; ui.toast = null; ui.flash = null; ed.reset(); }
    if (['POLISH', 'VIEW', 'KEEP', 'COMPARE'].includes(action.type)) { ui.flash = null; if (ui.toast && !ui.toast.undo) ui.toast = null; }
    if (action.type === 'UNDO') { ui.toast = {text: 'Undone. The previous text is back exactly.'}; ui.flash = null; }
    render();
  }

  /* Text with paragraphs, unclear-word chips, and optional diff highlights */
  function rich(text, cls) {
    const nodes = [];
    text.split(/(\[unclear\])/).forEach((part) => {
      if (!part) return;
      if (part === '[unclear]') nodes.push(el('span', {class: 'unclear-chip', title: 'Audio that couldn’t be made out. It stays marked instead of guessed.', text: '[unclear]'}));
      else nodes.push(document.createTextNode(part));
    });
    return cls ? [el('span', {class: cls}, ...nodes)] : nodes;
  }
  function richDiff(parts, side) {
    return parts.flatMap((p) => {
      if (p.type === 'same') return rich(p.text);
      if (p.type !== side) return [];
      return rich(p.text, side === 'del' ? 'smoothed' : 'smoothed-in');
    });
  }

  function textFor(version) {
    const v = state.entry[version];
    if (ui.editing === version) {
      const marked = ed.textNodes();
      if (marked) return marked;
    }
    if (ui.flash && ui.flash.version === version) {
      return TD.diffWords(ui.flash.before, ui.flash.after).flatMap((p) => (p.type === 'same' ? rich(p.text) : p.type === 'ins' ? rich(p.text, 'changed') : []));
    }
    return rich(v.text);
  }

  /* Flow bar: mode and microphone, shown separately */
  function renderStatus() {
    const journal = state.mode === 'journal';
    $('mode-chip').className = `mode-chip${journal ? ' on' : ''}`;
    $('mode-chip').replaceChildren(el('span', {class: 'mode-name', text: journal ? 'Journal Mode' : 'Normal mode'}), el('span', {class: 'mode-desc', text: journal ? 'Minimal cleanup' : 'Standard cleanup'}));
    const secs = state.recording ? Math.floor((Date.now() - ui.startedAt) / 1000) : 0;
    $('mic-chip').className = `mic-chip${state.recording ? ' live' : ''}`;
    $('mic-chip').textContent = state.recording ? `Listening (simulated) 0:${String(secs).padStart(2, '0')}` : 'Mic off';
    $('window').classList.toggle('journal-on', journal);
    const toggle = $('mode-toggle');
    toggle.setAttribute('aria-pressed', String(journal));
    toggle.textContent = journal ? 'Journal Mode on' : 'Journal Mode';
    toggle.disabled = state.recording;
    const rec = $('rec-button');
    rec.textContent = state.recording ? 'Stop' : 'Start recording';
    rec.classList.toggle('live', state.recording);
    rec.disabled = !state.recording && (state.mode !== 'journal' || !!state.entry);
    $('rec-hint').textContent = state.recording
      ? 'Journal Mode is locked for this recording. Stop inserts a prepared entry: nothing is recorded.'
      : state.entry ? 'This demo holds one entry. Reset to record again.'
        : journal ? 'Journal Mode applies to the next recording only.'
          : 'This demo scripts only a Journal Mode capture. Triple-press fn or use the Journal Mode button first.';
  }

  function renderPresses() {
    const n = state.presses.length;
    $('press-dots').replaceChildren(...[0, 1, 2].map((i) => el('span', {class: `dot${i < n ? ' on' : ''}${ui.pressFlash && i < 3 ? ' fired' : ''}`})));
    $('press-dots').setAttribute('aria-label', `${n} of 3 presses`);
  }

  function renderNotice() {
    const box = $('notice');
    box.hidden = !state.notice;
    box.textContent = state.notice || '';
  }

  /* The entry */
  function versionCol(version, compare) {
    const v = state.entry[version];
    const label = JM.VERSION_LABELS[version];
    const kept = state.entry.kept === version;
    const head = el('div', {class: 'version-head'},
      el('span', {class: `version-label v-${version}`, text: label}),
      v.edits ? el('span', {class: 'muted', text: `${v.edits} phrase edit${v.edits > 1 ? 's' : ''}`}) : null,
      version === 'polished' ? el('span', {class: 'tag tag-sim', text: 'Prepared, not generated'}) : null,
      kept ? el('span', {class: 'kept', text: '✓ Kept'}) : null);
    let body;
    if (compare && !ui.editing && !(ui.flash && ui.flash.version === version)) {
      const parts = TD.diffWords(state.entry.captured.text, state.entry.polished.text);
      body = richDiff(parts, version === 'captured' ? 'del' : 'ins');
    } else body = textFor(version);
    const actions = el('div', {class: 'button-row'},
      el('button', {type: 'button', class: `button small${kept ? '' : ' primary'}`, disabled: kept || !!ui.editing, onclick: () => { dispatch({type: 'KEEP', version}); }, text: kept ? 'Kept' : 'Keep this version'}),
      el('button', {type: 'button', class: 'button small', disabled: !!ui.editing, onclick: () => startEdit(version), text: 'Edit a phrase'}));
    return el('div', {class: `version${kept ? ' is-kept' : ''}`}, head, el('div', {class: 'entry-text pe-text', 'aria-live': 'polite'}, ...body), actions);
  }

  function renderEntry() {
    const box = $('entry');
    if (!state.entry) {
      box.replaceChildren(el('p', {class: 'entry-empty', text: state.recording ? 'Listening… (simulated)' : 'Your journal entry will appear here.'}));
      return;
    }
    const e = state.entry;
    const parts = [];
    if (e.polished) {
      parts.push(el('div', {class: 'version-bar'},
        el('div', {class: 'seg', role: 'group', 'aria-label': 'Version'},
          ...['captured', 'polished'].map((v) => el('button', {type: 'button', 'aria-pressed': String(!e.compare && e.viewing === v), disabled: !!ui.editing, onclick: () => { dispatch({type: 'COMPARE', on: false}); dispatch({type: 'VIEW', version: v}); }, text: JM.VERSION_LABELS[v]})),
          el('button', {type: 'button', 'aria-pressed': String(e.compare), disabled: !!ui.editing, onclick: () => dispatch({type: 'COMPARE', on: true}), text: 'Compare'}))));
    }
    if (e.polished && e.compare) {
      parts.push(el('div', {class: 'compare'}, versionCol('captured', true), versionCol('polished', true)));
      parts.push(el('p', {class: 'muted legend-line'}, el('span', {class: 'smoothed', text: 'tinted'}), ' in Captured: smoothed away by Polish. ', el('span', {class: 'smoothed-in', text: 'tinted'}), ' in Polished: new wording.'));
    } else {
      parts.push(versionCol(e.viewing, false));
      if (!e.polished) parts.push(el('div', {class: 'button-row'}, el('button', {type: 'button', class: 'button small', disabled: !!ui.editing, onclick: () => dispatch({type: 'POLISH'}), text: 'Polish'}), el('span', {class: 'muted', text: 'Makes a separate version. The capture stays.'})));
    }
    const keptLine = e.kept ? `Keeping the ${JM.VERSION_LABELS[e.kept]} version. ${e.polished ? `The ${JM.VERSION_LABELS[e.kept === 'captured' ? 'polished' : 'captured']} version is still here.` : ''}` : 'Nothing kept yet. Choose a version to keep.';
    parts.push(el('p', {class: 'kept-line muted', text: keptLine}));
    box.replaceChildren(...parts);
  }

  function startEdit(version) {
    ui.editing = version;
    ui.flash = null; ui.toast = null;
    $('editor-for').textContent = `Editing: ${JM.VERSION_LABELS[version]}`;
    ed.begin(state.entry[version].text, {});
  }

  function onEditorChange(action) {
    if (!ed.isEditing() && action.type !== 'APPLY') ui.editing = null;
    render();
  }

  function onApply(change) {
    const version = ui.editing;
    ui.editing = null;
    dispatch({type: 'EDIT_APPLIED', version, before: change.before, after: change.after});
    ui.flash = {version, before: change.before, after: change.after};
    ui.toast = {text: `${JM.VERSION_LABELS[version]}: changed “${change.removed}” to “${change.inserted}”`, undo: true};
    ed.reset();
  }

  function renderEditor() {
    $('editor-panel').hidden = !ui.editing;
  }

  function renderToast() {
    const t = $('j-toast');
    t.hidden = !ui.toast;
    if (!ui.toast) return;
    t.replaceChildren(el('span', {text: ui.toast.text}), ui.toast.undo && state.undo.length ? el('button', {type: 'button', class: 'button small', onclick: () => dispatch({type: 'UNDO'}), text: 'Undo'}) : null);
  }

  /* Side panel */
  const STEPS = [
    ['Turn on Journal Mode: triple-press fn, or the button', (ev) => ev.some((e) => e.startsWith('journal-on'))],
    ['Start recording, then Stop', (ev) => ev.includes('record-stop')],
    ['Polish: a separate version appears', (ev) => ev.includes('polish')],
    ['Keep one version', (ev) => ev.some((e) => e.startsWith('keep:'))],
    ['Go back to the Captured version', (ev) => ev.lastIndexOf('view:captured') > ev.indexOf('polish') && ev.includes('polish')],
    ['Edit a phrase in either version', (ev) => ev.some((e) => e.startsWith('edit:'))],
    ['Undo the edit', (ev) => ev.includes('undo')],
  ];
  function renderChecklist() {
    let nowSet = false;
    $('j-checklist').replaceChildren(...STEPS.map(([label, done]) => {
      const isDone = done(state.events);
      const cls = isDone ? 'done' : nowSet ? '' : 'now';
      if (!isDone) nowSet = true;
      return el('li', {class: cls, text: label});
    }), el('li', {text: 'Also: Reset returns everything to the start'}));
  }

  function renderCheck() {
    const e = state.entry;
    const box = $('j-check');
    const rows = [];
    if (!e) rows.push(el('p', {class: 'muted', text: 'Record an entry to start.'}));
    else {
      const capOk = e.captured.edits > 0 || e.captured.text === JM.CAPTURED;
      rows.push(el('p', {}, el('span', {class: capOk ? 'check-ok' : 'check-bad', text: capOk ? '✓ Captured version preserved' : '✗ Captured version changed without an edit'}), e.captured.edits ? ` (${e.captured.edits} phrase edit${e.captured.edits > 1 ? 's' : ''} you made)` : ' exactly as captured.'));
      if (e.polished) rows.push(el('p', {}, el('span', {class: 'check-ok', text: '✓ Both versions kept. '}), 'Switching or keeping one never deletes the other.'));
      rows.push(el('p', {class: 'muted', text: `Mode now: ${state.mode === 'journal' ? 'Journal Mode' : 'normal capture'}.`}));
    }
    box.replaceChildren(el('h3', {text: 'Version check'}), ...rows);
  }

  function render() {
    renderStatus(); renderPresses(); renderNotice(); renderEntry(); renderEditor(); renderToast(); renderChecklist(); renderCheck();
  }

  /* fn key: three presses inside the window. A physical Fn key is counted too when the browser reports it,
     which most don't; the on-screen key is the dependable path. */
  function press() {
    const before = state.mode;
    dispatch({type: 'PRESS', at: performance.now(), windowMs: ui.windowMs});
    if (state.mode !== before) {
      ui.pressFlash = true; renderPresses();
      setTimeout(() => { ui.pressFlash = null; renderPresses(); }, 400);
    }
  }

  function renderStatic() {
    const d = E.docs;
    $('hf-quote').textContent = `“${d.handsFree.quote}”`;
    $('hf-double').textContent = `“${d.handsFree.doubleTap}”`;
    $('hf-link').href = d.handsFree.url;
    $('tr-quote').textContent = `“${d.transforms.platforms} ${d.transforms.beta}”`;
    $('tr-link').href = d.transforms.url;
    $('ac-quote').textContent = `“${d.autoCleanup.quote}”`;
    $('ac-note').textContent = d.autoCleanup.note;
    $('ac-link').href = d.autoCleanup.url;
    document.querySelectorAll('[data-read-on]').forEach((n) => { n.textContent = `re-read ${fmtDate(d.readOn)}`; });
    $('sources').replaceChildren(...JM.CAPTURE_SOURCES.map((s) => el('li', {},
      el('span', {class: s.source === 'journal' ? 'tag tag-finding' : 'tag tag-sim', text: s.source === 'journal' ? 'My journal' : 'Scripted'}), ' ',
      el('q', {text: s.text.length > 70 ? `${s.text.slice(0, 68).replace(/\s+\S*$/, '')}…` : s.text}), el('span', {class: 'muted', text: ` ${s.note}`}))));
    $('preserved').replaceChildren(...JM.PRESERVED.map(([k, v]) => el('li', {}, el('strong', {text: `${k}: `}), v)));
  }

  function wire() {
    $('fn-key').addEventListener('click', press);
    $('mode-toggle').addEventListener('click', () => dispatch({type: 'TOGGLE_MODE', via: 'button'}));
    $('rec-button').addEventListener('click', () => dispatch({type: state.recording ? 'STOP_RECORDING' : 'START_RECORDING'}));
    $('j-reset').addEventListener('click', () => dispatch({type: 'RESET'}));
    $('editor-close').addEventListener('click', () => { ed.reset(); ui.editing = null; render(); });
    const slider = $('press-window');
    slider.value = ui.windowMs;
    $('press-window-out').textContent = `${ui.windowMs} ms`;
    slider.addEventListener('input', () => { ui.windowMs = Number(slider.value); $('press-window-out').textContent = `${ui.windowMs} ms`; storage.set(WINDOW_KEY, String(ui.windowMs)); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Fn' && !e.repeat) press(); });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(location.search).has('record')) document.body.classList.add('record');
    ed = window.PhraseEditor.create({words: $('editor-words'), controls: $('editor-controls'), compact: true, onChange: onEditorChange, onApply});
    renderStatic(); wire(); render();
  });
})();

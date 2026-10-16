/* Mobile Fix Strip: page rendering. State changes go through FixStrip.reduce (fixstrip-core.js). */
(function () {
  const {el, quoteCard} = window.WFP;
  const FS = window.FixStrip;
  const E = window.EVIDENCE;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let state = FS.initialState();
  const ui = {typing: null, listening: false, toast: null, flash: null, kbKey: '', timers: []};

  const $ = (id) => document.getElementById(id);
  const later = (fn, ms) => { const t = setTimeout(fn, ms); ui.timers.push(t); return t; };
  const clearTimers = () => { ui.timers.forEach(clearTimeout); ui.timers = []; };

  function dispatch(action) {
    const prev = state;
    state = FS.reduce(state, action);
    if (state === prev) return;
    if (action.type !== 'APPLY' && action.type !== 'UNDO') ui.toast = null;
    if (action.type === 'APPLY') {
      const c = state.lastChange;
      ui.toast = {text: `Changed “${c.removed}” to “${c.inserted}”`, undo: true};
      ui.flash = {start: c.start, end: c.start + c.inserted.length, settled: false};
      later(() => { if (ui.flash) { ui.flash.settled = true; document.querySelector('#composer .changed')?.classList.add('settled'); } }, 80);
    }
    if (action.type === 'UNDO') { ui.toast = {text: 'Undone. The original sentence is back.', undo: false}; ui.flash = null; later(() => { ui.toast = null; renderToast(); }, 3500); }
    if (action.type === 'RESET') { clearTimers(); ui.typing = null; ui.listening = false; ui.toast = null; ui.flash = null; }
    if (['OPEN_STRIP', 'TAP', 'START_REPLACE', 'CANCEL'].includes(action.type)) ui.flash = null;
    render();
  }

  /* Composer */
  function renderComposer() {
    const field = $('composer');
    field.replaceChildren();
    if (ui.typing !== null) { field.append(ui.typing, el('span', {class: 'caret', 'aria-hidden': 'true'})); return; }
    if (!state.text) { field.append(el('span', {class: 'placeholder', text: 'Message'})); return; }
    const preview = FS.previewText(state);
    if (preview) {
      field.append(preview.before, el('del', {text: preview.removed}), el('ins', {text: preview.inserted}), preview.after);
      return;
    }
    const range = FS.selectionRange(state);
    if (range) {
      field.append(state.text.slice(0, range.start), el('mark', {text: range.phrase}), state.text.slice(range.end));
      return;
    }
    if (ui.flash) {
      const {start, end, settled} = ui.flash;
      field.append(state.text.slice(0, start), el('span', {class: `changed${settled ? ' settled' : ''}`, text: state.text.slice(start, end)}), state.text.slice(end), el('span', {class: 'caret', 'aria-hidden': 'true'}));
      return;
    }
    field.append(state.text, el('span', {class: 'caret', 'aria-hidden': 'true'}));
  }

  /* Strip */
  function renderStrip() {
    const open = ['strip', 'replace', 'preview'].includes(state.phase);
    $('strip').hidden = !open;
    if (!open) return;
    const words = $('strip-words');
    const interactive = state.phase === 'strip';
    const tokens = FS.dictationTokens(state);
    words.replaceChildren(...tokens.map((t, i) => {
      if (!t.word) return el('span', {class: 'p', text: t.text});
      const on = state.sel && i >= state.sel.from && i <= state.sel.to;
      return el('button', {type: 'button', class: 'w', 'aria-pressed': on ? 'true' : 'false', disabled: !interactive && !on, tabindex: interactive ? null : '-1', onclick: () => dispatch({type: 'TAP', index: i}), text: t.text});
    }));
  }

  /* Keyboard area */
  const key = (label, attrs = {}) => el('button', {...attrs, type: 'button', class: `key ${attrs.class || ''}`.trim()}, label);
  const kbLabel = (left) => el('div', {class: 'kb-label'}, el('span', {text: left}), el('span', {text: 'Prototype keyboard'}));

  function startDictation() {
    if (state.phase !== 'empty' || ui.typing !== null) return;
    const words = FS.PREPARED_DICTATION.split(' ');
    if (reduceMotion) { dispatch({type: 'LOAD'}); return; }
    ui.listening = true; renderKb();
    later(() => {
      ui.listening = false; ui.typing = ''; render();
      words.forEach((_, i) => later(() => {
        ui.typing = words.slice(0, i + 1).join(' ');
        renderComposer();
        if (i === words.length - 1) later(() => { ui.typing = null; dispatch({type: 'LOAD'}); }, 120);
      }, 70 * i));
    }, 900);
  }

  function sayReplacement() {
    const range = FS.selectionRange(state);
    const phrase = range && FS.simulatedReplacementFor(range.phrase);
    if (!phrase || ui.listening) return;
    if (reduceMotion) { dispatch({type: 'SET_REPLACEMENT', text: phrase, simulated: true}); dispatch({type: 'PREVIEW'}); return; }
    ui.listening = true; renderKb();
    later(() => {
      ui.listening = false;
      dispatch({type: 'SET_REPLACEMENT', text: phrase, simulated: true});
      later(() => dispatch({type: 'PREVIEW'}), 250);
    }, 1000);
  }

  function renderKb() {
    const range = FS.selectionRange(state);
    const kbKey = [state.phase, range ? `${range.start}-${range.end}` : '', ui.listening, ui.typing !== null].join('|');
    if (kbKey === ui.kbKey) { syncPreviewButton(); return; }
    ui.kbKey = kbKey;
    const kb = $('kb');
    let focus = null;
    const parts = [];

    if (ui.typing !== null) {
      parts.push(kbLabel('Dictating'), el('div', {class: 'kb-main'}, el('span', {class: 'sim-note', text: 'Simulated: prepared sentence'})));
    } else if (state.phase === 'empty') {
      const mic = el('button', {type: 'button', class: `mic${ui.listening ? ' listening' : ''}`, onclick: startDictation, 'aria-label': 'Dictate (simulated: inserts a prepared sentence)'}, ui.listening ? '…' : 'Dictate');
      parts.push(kbLabel('Voice'), el('div', {class: 'kb-main'}, mic,
        el('span', {class: 'sim-note', text: ui.listening ? 'Simulated listening' : 'Simulated: inserts a prepared sentence'})));
      focus = mic;
    } else if (state.phase === 'idle') {
      const fix = key('Fix a phrase', {class: 'fix', onclick: () => dispatch({type: 'OPEN_STRIP'})});
      parts.push(kbLabel('Voice'), el('div', {class: 'kb-main'},
        el('p', {class: 'hint', text: state.undo ? 'Message updated. Undo is in the bar above.' : 'Spotted a wrong word? Fix it here without switching keyboards.'}),
        el('div', {class: 'kb-row'}, fix)));
      focus = fix;
    } else if (state.phase === 'strip') {
      const replace = key('Replace selection', {class: 'primary', disabled: !range, onclick: () => dispatch({type: 'START_REPLACE'})});
      parts.push(kbLabel('Fix'), el('div', {class: 'kb-main'},
        el('p', {class: 'hint', text: range ? `Selected “${range.phrase}”. Tap another word to extend the phrase.` : 'Tap the word to change in the strip above.'}),
        el('div', {class: 'kb-row'}, replace, key('Close', {onclick: () => dispatch({type: 'CLOSE_STRIP'})}))));
      focus = range ? replace : null;
    } else if (state.phase === 'replace') {
      const prepared = FS.simulatedReplacementFor(range.phrase);
      const say = el('button', {type: 'button', class: `mic${ui.listening ? ' listening' : ''}`, disabled: !prepared, onclick: sayReplacement, 'aria-label': 'Say the replacement (simulated)'}, ui.listening ? '…' : 'Say it');
      const input = el('input', {type: 'text', id: 'replacement', placeholder: 'or type the replacement', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Type the replacement'});
      input.value = state.replacement;
      input.addEventListener('input', () => dispatch({type: 'SET_REPLACEMENT', text: input.value}));
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') dispatch({type: 'PREVIEW'}); });
      parts.push(kbLabel('Replace'), el('div', {class: 'kb-main'},
        el('p', {class: 'replace-target'}, 'Replace ', el('b', {text: range.phrase}), ' with…'),
        say,
        el('span', {class: 'sim-note', text: ui.listening ? 'Simulated listening' : prepared ? `Simulated: fills in “${prepared}”` : 'No prepared phrase for this selection: type instead'}),
        input,
        el('div', {class: 'kb-row'}, key('Preview', {class: 'primary', id: 'preview-btn', onclick: () => dispatch({type: 'PREVIEW'})}), key('Cancel', {onclick: () => dispatch({type: 'CANCEL'})}))));
      focus = prepared ? say : input;
    } else if (state.phase === 'preview') {
      const apply = key('Apply', {class: 'primary', onclick: () => dispatch({type: 'APPLY'})});
      parts.push(kbLabel('Preview'), el('div', {class: 'kb-main'},
        el('p', {class: 'swap'}, el('s', {text: range.phrase}), ' → ', el('b', {text: state.replacement})),
        el('p', {class: 'hint', text: 'Only this phrase changes. Everything else stays as you dictated it.'}),
        el('div', {class: 'kb-row'}, apply, key('Change', {onclick: () => dispatch({type: 'EDIT'})}), key('Cancel', {onclick: () => dispatch({type: 'CANCEL'})}))));
      focus = apply;
    }
    kb.replaceChildren(...parts);
    syncPreviewButton();
    if (focus && document.activeElement && document.getElementById('phone').contains(document.activeElement)) focus.focus({preventScroll: true});
  }

  function syncPreviewButton() {
    const btn = $('preview-btn');
    if (btn) btn.disabled = !state.replacement.trim();
  }

  function renderToast() {
    const toast = $('toast');
    toast.hidden = !ui.toast;
    if (!ui.toast) return;
    toast.replaceChildren(el('span', {text: ui.toast.text}));
    if (ui.toast.undo && state.undo) toast.append(el('button', {type: 'button', onclick: () => dispatch({type: 'UNDO'}), text: 'Undo'}));
  }

  /* Side panel: steps and the character check */
  const STEPS = [
    ['Load the prepared dictation', (ev) => ev.includes('load')],
    ['Open the fix strip', (ev) => ev.includes('open')],
    ['Select “Tuesday”', (ev) => ev.some((e) => e.toLowerCase() === 'select:tuesday')],
    ['Say or type “Thursday”', (ev) => ev.includes('simulated-speech') || ev.includes('preview')],
    ['Preview the change', (ev) => ev.includes('preview')],
    ['Apply it', (ev) => ev.includes('apply')],
    ['Undo it', (ev) => ev.includes('undo')],
  ];

  function renderChecklist() {
    let nowSet = false;
    $('checklist').replaceChildren(...STEPS.map(([label, done]) => {
      const isDone = done(state.events);
      const cls = isDone ? 'done' : nowSet ? '' : 'now';
      if (!isDone) nowSet = true;
      return el('li', {class: cls, text: label});
    }), el('li', {class: state.events.includes('cancel') ? 'done' : '', text: 'Also: cancel a correction, then Reset'}));
  }

  function renderIntegrity() {
    const box = $('integrity-msg').parentElement;
    const rows = [];
    let msg;
    const last = state.events[state.events.length - 1];
    if (!state.text) msg = el('p', {class: 'muted', text: 'Load the dictation to start.'});
    else if (state.phase === 'preview') msg = el('p', {class: 'muted', text: 'Preview only. The message text has not changed yet.'});
    else if (state.lastChange && state.phase === 'idle') {
      const c = state.lastChange;
      const ok = FS.preservedOutside(c.before, c.after, c.start, c.end, c.inserted);
      msg = el('p', {}, el('span', {class: ok ? 'check-ok' : 'check-bad', text: ok ? '✓ Only the selected phrase changed. ' : '✗ Text outside the selection changed. '}),
        `${c.start} characters before it and ${c.before.length - c.end} after it match the original exactly.`);
      rows.push(el('div', {class: 'check-row'}, el('span', {class: 'muted', text: 'Before'}), el('code', {text: c.before}), el('span', {class: 'muted', text: 'After'}), el('code', {text: c.after})));
    } else if (last === 'undo') {
      const ok = state.text === FS.PREPARED_DICTATION;
      msg = el('p', {}, el('span', {class: ok ? 'check-ok' : 'check-bad', text: ok ? '✓ Undo restored the original sentence exactly ' : '✗ Undo did not restore the original '}), `(${state.text.length} characters).`);
    } else if (last === 'cancel') {
      const ok = state.text === FS.PREPARED_DICTATION;
      msg = el('p', {}, el('span', {class: ok ? 'check-ok' : 'check-bad', text: ok ? '✓ Cancelled. The message is unchanged.' : '✗ Cancel changed the message.'}));
    } else msg = el('p', {class: 'muted', text: 'No change made yet. The check runs after Apply, Undo or Cancel.'});
    msg.id = 'integrity-msg';
    box.replaceChildren(el('h3', {text: 'Text check'}), msg, ...rows);
  }

  function render() {
    renderComposer(); renderStrip(); renderKb(); renderToast(); renderChecklist(); renderIntegrity();
  }

  function renderStatic() {
    $('dash-link').href = E.DASHBOARD;
    $('fix-evidence').replaceChildren(...E.fixStrip.map(quoteCard));
    const d = E.docs;
    $('docs-block').replaceChildren(
      el('div', {class: 'button-row'}, el('span', {class: 'tag tag-shipping', text: 'Wispr docs'}), el('span', {class: 'muted', text: `read ${window.WFP.fmtDate(d.readOn)}`})),
      el('h3', {text: 'Command Mode is desktop-first'}),
      el('blockquote', {class: 'doc-quote', text: `“${d.commandMode.quote}”`}),
      el('p', {class: 'muted'}, 'Source: ', el('a', {href: d.commandMode.url, target: '_blank', rel: 'noopener', text: d.commandMode.title})),
      el('h3', {text: 'iOS Polish rewrites a selection'}),
      el('blockquote', {class: 'doc-quote', text: `“${d.transforms.quote}”`}),
      el('p', {class: 'muted'}, 'Polish applies instructions such as concision or grammar to the selected text. It is a rewrite, not an exact swap of one phrase. Source: ', el('a', {href: d.transforms.url, target: '_blank', rel: 'noopener', text: d.transforms.title})));
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(location.search).has('record')) document.body.classList.add('record');
    renderStatic();
    $('strip-close').addEventListener('click', () => { if (state.phase === 'strip') dispatch({type: 'CLOSE_STRIP'}); else { dispatch({type: 'CANCEL'}); dispatch({type: 'CLOSE_STRIP'}); } });
    $('reset').addEventListener('click', () => dispatch({type: 'RESET'}));
    render();
  });
})();

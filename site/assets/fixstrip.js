/* Phrase Repair page. The word strip and the repair panel are the shared component (phrase-editor.js);
   this file owns the phone (iOS or Android preview), the dictation, the undo bar and the side panel.
   Highlights, alternatives and repeats come from the scenario data in fixstrip-core.js. */
(function () {
  const {el, quoteCard} = window.WFP;
  const FS = window.FixStrip;
  const E = window.EVIDENCE;
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);

  const params = new URLSearchParams(location.search);
  let scenario = FS.scenarioById(params.get('scenario'));
  let platform = params.get('platform') === 'android' ? 'android' : 'ios';
  const ui = {typing: null, listening: false, toast: null, flash: null, timers: []};
  const later = (fn, ms) => { const t = setTimeout(fn, ms); ui.timers.push(t); return t; };
  const clearTimers = () => { ui.timers.forEach(clearTimeout); ui.timers = []; };

  const kbLabel = (left) => el('div', {class: 'kb-label'}, el('span', {text: left}), el('span', {text: document.body.dataset.device === 'desktop' ? 'Flow bar · prototype' : 'Prototype keyboard'}));
  let ed;

  function onEditorChange(action) {
    const s = ed.state;
    if (action.type === 'APPLY') {
      const c = s.lastChange;
      ui.toast = {text: `Changed “${c.removed}” to “${c.inserted}”`, undo: true};
      ui.flash = {start: c.start, end: c.start + c.inserted.length, settled: false};
      later(() => { if (ui.flash) { ui.flash.settled = true; document.querySelector('#composer .changed')?.classList.add('settled'); } }, 80);
    } else if (action.type === 'UNDO') {
      ui.toast = {text: 'Undone. The original sentence is back.', undo: false}; ui.flash = null;
      later(() => { ui.toast = null; renderToast(); }, 3500);
    } else if (action.type === 'DISMISS') {
      ui.toast = {text: 'Kept as written. Nothing changed.', undo: false}; ui.flash = null;
      later(() => { ui.toast = null; renderToast(); }, 3000);
    } else if (action.type !== 'SET_REPLACEMENT') {
      ui.toast = null;
      if (['OPEN_STRIP', 'OPEN_HIGHLIGHT', 'TAP', 'START_REPLACE', 'CANCEL', 'RESET', 'SEND'].includes(action.type)) ui.flash = null;
    }
    render();
  }

  /* Composer */
  function renderComposer() {
    const field = $('composer');
    const s = ed.state;
    field.replaceChildren();
    $('send').disabled = s.phase !== 'idle' || ui.typing !== null;
    if (ui.typing !== null) { field.append(ui.typing, el('span', {class: 'caret', 'aria-hidden': 'true'})); return; }
    if (!s.text || s.phase === 'sent') { field.append(el('span', {class: 'placeholder', text: platform === 'android' ? 'Text message' : 'Message'})); return; }
    const marked = ed.textNodes();
    if (marked) { field.append(...marked); return; }
    if (ui.flash && !FS.openHighlights(s).length) {
      const {start, end, settled} = ui.flash;
      field.append(s.text.slice(0, start), el('span', {class: `changed${settled ? ' settled' : ''}`, text: s.text.slice(start, end)}), s.text.slice(end), el('span', {class: 'caret', 'aria-hidden': 'true'}));
      return;
    }
    field.append(...ed.markedText((id) => ed.dispatch({type: 'OPEN_HIGHLIGHT', id})), el('span', {class: 'caret', 'aria-hidden': 'true'}));
  }

  function renderThread() {
    const out = $('thread-out');
    out.hidden = ed.state.phase !== 'sent';
    if (ed.state.phase === 'sent') out.textContent = ed.state.sent.text;
  }

  /* Keyboard area outside the editor: dictate, then the repair entry points */
  function startDictation() {
    if (ed.state.phase !== 'empty' || ui.typing !== null) return;
    const load = () => ed.dispatch({type: 'LOAD', text: scenario.text, highlights: scenario.highlights});
    const words = scenario.text.split(' ');
    if (reduceMotion()) { load(); return; }
    ui.listening = true; renderKbHost();
    later(() => {
      ui.listening = false; ui.typing = ''; render();
      words.forEach((_, i) => later(() => {
        ui.typing = words.slice(0, i + 1).join(' ');
        renderComposer();
        if (i === words.length - 1) later(() => { ui.typing = null; load(); }, 120);
      }, 80 * i));
    }, 900);
  }

  let hostKey = '';
  function renderKbHost() {
    const editing = ed.isEditing();
    $('kb-host').hidden = editing;
    $('kb-editor').hidden = !editing;
    $('strip').hidden = !editing;
    const s = ed.state;
    const open = FS.openHighlights(s);
    const key = [s.phase, ui.listening, ui.typing !== null, !!s.undo, open.length].join('|');
    if (editing || key === hostKey) return;
    hostKey = key;
    const hadFocus = $('phone').contains(document.activeElement) || document.activeElement === document.body;
    let focus = null;
    const parts = [];
    if (ui.typing !== null) {
      parts.push(kbLabel('Dictating'), el('div', {class: 'kb-main'}, el('span', {class: 'sim-note', text: 'Simulated: prepared sentence'})));
    } else if (s.phase === 'empty') {
      const mic = el('button', {type: 'button', class: `mic${ui.listening ? ' listening' : ''}`, onclick: startDictation, 'aria-label': 'Dictate (simulated: inserts a prepared sentence)'}, ui.listening ? '…' : 'Dictate');
      parts.push(kbLabel('Voice'), el('div', {class: 'kb-main'}, mic, el('span', {class: 'sim-note', text: ui.listening ? 'Simulated listening' : 'Simulated: inserts a prepared sentence'})));
      focus = mic;
    } else if (s.phase === 'idle') {
      const fix = el('button', {type: 'button', class: 'key', onclick: () => ed.dispatch({type: 'OPEN_STRIP'})}, 'Edit a phrase');
      if (open.length) {
        const check = el('button', {type: 'button', class: 'key fix', onclick: () => ed.dispatch({type: 'OPEN_HIGHLIGHT', id: open[0].id})}, FS.HIGHLIGHT_LABEL);
        parts.push(kbLabel('Voice'), el('div', {class: 'kb-main'},
          el('p', {class: 'hint'}, `Flow marked “${s.text.slice(open[0].start, open[0].end)}” to check. Optional: you can send as is.`),
          el('div', {class: 'kb-row'}, check, fix),
          el('span', {class: 'sim-note', text: 'Simulated mark: demo data, not a confidence score'})));
        focus = check;
      } else {
        parts.push(kbLabel('Voice'), el('div', {class: 'kb-main'},
          el('p', {class: 'hint', text: s.undo ? 'Message updated. Undo is in the bar above.' : 'Spotted a wrong word? Select any phrase to repair it.'}),
          el('div', {class: 'kb-row'}, fix)));
        focus = fix;
      }
    } else if (s.phase === 'sent') {
      parts.push(kbLabel('Voice'), el('div', {class: 'kb-main'},
        el('p', {class: 'hint', text: s.sent.openHighlights ? 'Sent with a marked phrase unchecked. Highlights never block sending.' : 'Sent (in this demo only).'}),
        el('div', {class: 'kb-row'}, el('button', {type: 'button', class: 'key', onclick: () => setScenario(scenario.id)}, 'Start again'))));
    }
    $('kb-host').replaceChildren(...parts);
    if (focus && hadFocus && s.events.length) focus.focus({preventScroll: true});
  }

  function renderToast() {
    const toast = $('toast');
    toast.hidden = !ui.toast;
    if (!ui.toast) return;
    toast.replaceChildren(el('span', {text: ui.toast.text}));
    if (ui.toast.undo && ed.state.undo) toast.append(el('button', {type: 'button', onclick: () => ed.dispatch({type: 'UNDO'}), text: 'Undo'}));
  }

  /* Side panel: scenario, steps and the character check */
  function steps() {
    const h = scenario.highlights[0];
    const ev = (name) => (list) => list.includes(name);
    const checked = (list) => list.some((e) => e === `check:${h.phrase}`);
    if (scenario.id === 'false-alarm') {
      return [
        ['Dictate the prepared sentence', ev('load')],
        [`Tap the marked “${h.phrase}”`, checked],
        ['Keep as written', (l) => l.some((e) => e.startsWith('dismiss:'))],
        ['Send it', ev('send')],
      ];
    }
    const fixed = (l) => l.includes('simulated-speech') || l.some((e) => e.startsWith('choose:'));
    return [
      ['Dictate the prepared sentence', ev('load')],
      [`Tap the marked “${h.phrase}”`, checked],
      [scenario.goal.replace(/\.$/, ''), fixed],
      ['Preview the change', ev('preview')],
      ['Apply it', ev('apply')],
      ['Undo it', ev('undo')],
    ];
  }

  function renderChecklist() {
    const ev = ed.state.events;
    let nowSet = false;
    $('checklist').replaceChildren(...steps().map(([label, done]) => {
      const isDone = done(ev);
      const cls = isDone ? 'done' : nowSet ? '' : 'now';
      if (!isDone) nowSet = true;
      return el('li', {class: cls, text: label});
    }), el('li', {class: ev.includes('cancel') ? 'done' : '', text: 'Also: select any other phrase with Edit a phrase, and cancel'}));
  }

  function renderIntegrity() {
    const box = $('integrity');
    const s = ed.state;
    const rows = [];
    let msg;
    const last = s.events[s.events.length - 1] || '';
    if (!s.text) msg = el('p', {class: 'muted', text: 'Dictate to start.'});
    else if (s.phase === 'preview') msg = el('p', {class: 'muted', text: 'Preview only. The message text has not changed yet.'});
    else if (s.phase === 'sent') msg = el('p', {}, el('span', {class: 'check-ok', text: '✓ Sent. '}), s.sent.openHighlights ? 'A marked phrase was left unchecked, which is allowed.' : 'No marks were left open.');
    else if (last.startsWith('dismiss:')) {
      const ok = s.text === scenario.text || (s.lastChange && s.text === s.lastChange.after);
      msg = el('p', {}, el('span', {class: ok ? 'check-ok' : 'check-bad', text: ok ? '✓ Highlight dismissed. The message is unchanged.' : '✗ Dismissing changed the message.'}));
    } else if (s.lastChange && s.phase === 'idle') {
      const c = s.lastChange;
      const ok = FS.preservedOutside(c.before, c.after, c.start, c.end, c.inserted);
      msg = el('p', {}, el('span', {class: ok ? 'check-ok' : 'check-bad', text: ok ? '✓ Only the selected span changed. ' : '✗ Text outside the selection changed. '}),
        `${c.start} characters before it and ${c.before.length - c.end} after it match exactly. Source: ${{alternative: 'suggested alternative', speech: 'said again (simulated)', typed: 'typed'}[c.source] || 'typed'}.`);
      rows.push(el('div', {class: 'check-row'}, el('span', {class: 'muted', text: 'Before'}), el('code', {text: c.before}), el('span', {class: 'muted', text: 'After'}), el('code', {text: c.after})));
    } else if (last === 'undo') {
      const ok = s.text === scenario.text;
      msg = el('p', {}, el('span', {class: ok ? 'check-ok' : 'check-bad', text: ok ? '✓ Undo restored the original sentence exactly ' : '✗ Undo did not restore the original '}), `(${s.text.length} characters).`);
    } else if (last === 'cancel') {
      const ok = s.text === scenario.text;
      msg = el('p', {}, el('span', {class: ok ? 'check-ok' : 'check-bad', text: ok ? '✓ Cancelled. The message is unchanged.' : '✗ Cancel changed the message.'}));
    } else msg = el('p', {class: 'muted', text: 'No change made yet. The check runs after Apply, Undo, Cancel or Keep as written.'});
    box.replaceChildren(el('h3', {text: 'Text check'}), msg, ...rows);
  }

  function renderScenario() {
    document.querySelectorAll('[data-scenario]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scenario === scenario.id)));
    document.querySelectorAll('[data-platform]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.platform === platform)));
    $('phone').classList.toggle('android', platform === 'android');
    $('platform-name').textContent = platform === 'android' ? 'Android preview' : 'iPhone preview';
    $('scenario-source').textContent = `${scenario.goal} ${scenario.source}`;
    $('scenario-tag').className = scenario.id === 'product' ? 'tag tag-finding' : 'tag tag-sim';
    $('scenario-tag').textContent = scenario.id === 'product' ? 'From my test' : 'Scripted';
    $('thread-name').textContent = scenario.thread;
    $('thread-in').textContent = scenario.incoming;
    $('avatar').textContent = scenario.thread[0];
  }

  function render() {
    renderComposer(); renderThread(); renderKbHost(); renderToast(); renderChecklist(); renderIntegrity();
  }

  function setURL() {
    const url = new URL(location.href);
    if (scenario.id === FS.SCENARIOS[0].id) url.searchParams.delete('scenario'); else url.searchParams.set('scenario', scenario.id);
    if (platform === 'ios') url.searchParams.delete('platform'); else url.searchParams.set('platform', platform);
    history.replaceState(null, '', url);
  }

  function setScenario(id) {
    scenario = FS.scenarioById(id);
    clearTimers(); ui.typing = null; ui.listening = false; ui.toast = null; ui.flash = null; hostKey = '';
    ed.reset();
    renderScenario(); render(); setURL();
  }

  function renderStatic() {
    $('dash-link').href = E.DASHBOARD;
    $('fix-evidence').replaceChildren(...E.fixStrip.map(quoteCard));
    const d = E.docs;
    $('voice-edit-claim').textContent = d.voiceEditClaim;
    $('docs-block').replaceChildren(
      el('div', {class: 'button-row'}, el('span', {class: 'tag tag-shipping', text: 'Wispr docs'}), el('span', {class: 'muted', text: `re-read ${window.WFP.fmtDate(d.readOn)}`})),
      el('h3', {text: 'Command Mode is desktop-first'}),
      el('blockquote', {class: 'doc-quote', text: `“${d.commandMode.quote}”`}),
      el('p', {class: 'muted'}, 'Source: ', el('a', {href: d.commandMode.url, target: '_blank', rel: 'noopener', text: d.commandMode.title})),
      el('h3', {text: 'iOS Polish rewrites a selection'}),
      el('blockquote', {class: 'doc-quote', text: `“${d.transforms.quote}”`}),
      el('p', {class: 'muted'}, 'Polish applies instructions such as concision or grammar to the selected text. It is a rewrite, not an exact swap of one phrase. Source: ', el('a', {href: d.transforms.url, target: '_blank', rel: 'noopener', text: d.transforms.title})));
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (params.has('record')) document.body.classList.add('record');
    ed = window.PhraseEditor.create({words: $('strip-words'), controls: $('kb-editor'), frame: (label, body) => [kbLabel(label), body], onChange: onEditorChange});
    renderStatic();
    renderScenario();
    document.querySelectorAll('[data-scenario]').forEach((b) => b.addEventListener('click', () => setScenario(b.dataset.scenario)));
    document.querySelectorAll('[data-platform]').forEach((b) => b.addEventListener('click', () => { platform = b.dataset.platform; hostKey = ''; renderScenario(); render(); setURL(); }));
    $('send').addEventListener('click', () => ed.dispatch({type: 'SEND'}));
    $('strip-close').addEventListener('click', () => { if (ed.state.phase !== 'strip') ed.dispatch({type: 'CANCEL'}); ed.dispatch({type: 'CLOSE_STRIP'}); });
    $('reset').addEventListener('click', () => setScenario(scenario.id));
    window.addEventListener('wfp:device', () => { hostKey = ''; render(); });
    render();
  });
})();

/* Review Revisions page. State goes through ReviewRevisions.reduce (revisions-core.js); phrase edits use the
   shared phrase editor (phrase-editor.js). Cards, earlier choices and excerpts are prepared demo data. */
(function () {
  const {el} = window.WFP;
  const RR = window.ReviewRevisions;
  const TD = window.TextDiff;
  const $ = (id) => document.getElementById(id);

  const params = new URLSearchParams(location.search);
  let state = RR.createState(params.get('scenario') || 'guests');
  const ui = {history: new Set(), source: null, toast: null, editing: false, seen: new Set()};
  let ed;
  const scenario = () => RR.scenarioById(state.scenarioId);

  function dispatch(action) {
    const prev = state;
    state = RR.reduce(state, action);
    if (state === prev) return;
    if (action.type === 'APPLY') ui.toast = {text: `Updated: ${state.lastChange.changes.join('; ')}`, undo: true};
    else if (action.type === 'UNDO') ui.toast = {text: 'Undone. The previous message is back exactly.'};
    else if (action.type !== 'TEXT_EDIT') ui.toast = null;
    if (action.type === 'RESET') { ui.history.clear(); ui.source = null; ui.seen.clear(); ui.editing = false; ed.reset(); }
    render();
  }

  /* Message */
  function renderMessage() {
    const box = $('message');
    let nodes;
    if (ui.editing && ed.textNodes()) nodes = ed.textNodes();
    else if (state.preview) {
      nodes = state.preview.sentences.flatMap((s, i) => {
        const sep = i ? [' '] : [];
        const before = state.sentences.find((c) => c.id === s.id);
        if (!state.preview.changed.includes(s.id)) return [...sep, s.text];
        const parts = before ? TD.diffWords(before.text, s.text) : [{type: 'ins', text: s.text}];
        return [...sep, el('span', {class: 'changed-sentence'}, ...parts.map((p) => (p.type === 'same' ? p.text : el(p.type, {text: p.text}))))];
      });
      state.preview.removed.forEach((id) => { const r = state.sentences.find((c) => c.id === id); if (r) nodes.push(' ', el('span', {class: 'changed-sentence'}, el('del', {text: r.text}))); });
    } else if (state.lastChange && state.lastChange.kind === 'decision' && ui.toast && ui.toast.undo) {
      nodes = state.sentences.flatMap((s, i) => [...(i ? [' '] : []), state.lastChange.changed.includes(s.id) ? el('span', {class: 'changed'}, s.text) : s.text]);
    } else nodes = [RR.textOf(state)];
    box.replaceChildren(...nodes);
    $('message-state').textContent = state.preview ? 'Preview: the message hasn’t changed yet.' : state.manualEdits ? `Edited by hand (${state.manualEdits}).` : '';
    $('original-text').textContent = state.original;

    const sc = scenario();
    const control = $('review-control');
    control.hidden = !RR.hasRevisions(sc);
    control.setAttribute('aria-expanded', String(state.open));
    control.textContent = state.open ? 'Hide review' : `Review revisions · ${sc.groups.length} decision${sc.groups.length > 1 ? 's' : ''}`;
    $('no-revisions').hidden = RR.hasRevisions(sc);
    $('edit-phrase').disabled = ui.editing || !!state.preview || !!state.draft;
  }

  /* Review panel */
  const KIND = {replaced: ['Replaced', 'k-replaced'], current: ['Current', 'k-current'], unresolved: ['Unresolved', 'k-unresolved'], condition: ['Condition still applies', 'k-condition']};
  const kindTag = (k) => el('span', {class: `kind ${KIND[k][1]}`, text: KIND[k][0]});
  const draftOr = () => state.draft || state.applied;

  function seg(options, value, onPick, label) {
    return el('div', {class: 'seg', role: 'radiogroup', 'aria-label': label}, ...options.map(([v, l]) => el('button', {type: 'button', role: 'radio', 'aria-checked': String(v === value), disabled: !!state.preview, onclick: () => onPick(v), text: l})));
  }

  function excerptView(group) {
    const sc = scenario();
    if (ui.source !== group.id) return null;
    if (!sc.input) {
      return el('div', {class: 'excerpt none'}, el('span', {class: 'tag tag-unverified', text: 'No verified source'}),
        el('p', {text: 'The recording for this test hasn’t been checked yet, so there’s no spoken excerpt to show. Earlier choices aren’t guessed from the cleaned text.'}));
    }
    const keys = new Set((group.history || []).map((h) => h.excerpt).concat((group.options || []).map((o) => o.excerpt)).concat(group.excerpt ? [group.excerpt] : []));
    return el('div', {class: 'excerpt'}, el('span', {class: 'tag tag-sim', text: 'Scripted input · demo data'}),
      el('p', {}, ...Object.entries(sc.excerpts).flatMap(([k, t], i) => [i ? ' ' : '', keys.has(k) ? el('mark', {text: t}) : t])));
  }

  function groupHead(group, status, changed) {
    const sourceOn = ui.source === group.id;
    return el('div', {class: 'group-head'},
      el('h4', {text: group.label}), status,
      changed ? el('span', {class: 'draft-chip', text: 'Changed, not applied'}) : null,
      el('span', {class: 'group-links'},
        group.history !== undefined ? el('button', {type: 'button', class: 'link', 'aria-expanded': String(ui.history.has(group.id)), onclick: () => { toggle(ui.history, group.id); ui.seen.add(`history:${group.id}`); render(); }, text: ui.history.has(group.id) ? 'Hide revisions' : 'View revisions'}) : null,
        el('button', {type: 'button', class: 'link', 'aria-expanded': String(sourceOn), onclick: () => { ui.source = sourceOn ? null : group.id; ui.seen.add(`source:${group.id}`); render(); }, text: sourceOn ? 'Hide source' : 'Source'})));
  }
  const toggle = (set, v) => (set.has(v) ? set.delete(v) : set.add(v));

  function peopleCard(group) {
    const d = draftOr()[group.id];
    const changed = state.draft && JSON.stringify(state.draft[group.id]) !== JSON.stringify(state.applied[group.id]);
    const rows = group.people.map((name) => el('div', {class: 'person'},
      el('span', {class: 'person-name', text: name}),
      seg(group.statuses, d[name], (v) => dispatch({type: 'SET', group: group.id, key: name, value: v}), `${name}'s status`)));
    const hist = ui.history.has(group.id) ? el('div', {class: 'history none'}, el('p', {class: 'muted', text: 'No earlier choices listed. They would come from the recording, which hasn’t been checked. Names aren’t inferred from the cleaned text alone.'})) : null;
    return el('article', {class: 'group'}, groupHead(group, kindTag('current'), changed),
      el('p', {class: 'muted small', text: 'Starts from what the message says now. Each person’s status changes on its own.'}), ...rows, hist, excerptView(group));
  }

  function choiceCard(group) {
    const value = draftOr()[group.id];
    const changed = state.draft && state.draft[group.id] !== state.applied[group.id];
    const values = [...new Set(group.history.map((h) => h.value))];
    const lastIdx = group.history.length - 1;
    const hist = ui.history.has(group.id) ? el('ol', {class: 'history'}, ...group.history.map((h, i) => {
      const superseded = i < lastIdx && h.value !== group.history[lastIdx].value;
      const kind = i === lastIdx ? 'current' : superseded ? 'replaced' : null;
      return el('li', {},
        el('span', {class: 'h-value', text: h.value}),
        kind ? kindTag(kind) : el('span', {class: 'kind k-restated', text: 'Restated later'}),
        el('span', {class: 'muted', text: ` heard as “${h.heard}”`}),
        h.note ? el('p', {class: 'muted small', text: h.note}) : null,
        superseded && value !== h.value ? el('button', {type: 'button', class: 'button small', disabled: !!state.preview, onclick: () => { ui.seen.add(`restore:${group.id}`); dispatch({type: 'SET', group: group.id, value: h.value}); }, text: `Use ${h.value}`}) : null);
    })) : null;
    return el('article', {class: 'group'}, groupHead(group, kindTag('current'), changed),
      el('p', {class: 'current-value', text: value}),
      seg(values.map((v) => [v, v]), value, (v) => dispatch({type: 'SET', group: group.id, value: v}), group.label),
      hist, excerptView(group));
  }

  function optionsCard(group) {
    const d = draftOr();
    const value = d[group.id];
    const changed = state.draft && state.draft[group.id] !== state.applied[group.id];
    const rows = group.options.map((o) => el('label', {class: `option${value === o.value ? ' picked' : ''}`},
      el('input', {type: 'radio', name: `opt-${group.id}`, checked: value === o.value, disabled: !!state.preview, onchange: () => dispatch({type: 'SET', group: group.id, value: o.value})}),
      el('span', {class: 'option-name', text: o.value}),
      el('span', {class: `kind k-${o.status}`, text: o.label}),
      el('span', {class: 'muted', text: o.note})));
    rows.push(el('label', {class: `option${value === null ? ' picked' : ''}`},
      el('input', {type: 'radio', name: `opt-${group.id}`, checked: value === null, disabled: !!state.preview, onchange: () => dispatch({type: 'SET', group: group.id, value: null})}),
      el('span', {class: 'option-name', text: 'Leave it open'}), el('span', {class: 'muted', text: 'no day chosen'})));
    return el('article', {class: 'group'}, groupHead(group, value ? kindTag('current') : kindTag('unresolved'), changed),
      el('p', {class: 'muted small', text: value ? `${value} chosen. Choosing doesn’t confirm it.` : 'Nothing was decided. Choose a day, or leave it open.'}),
      el('div', {class: 'options', role: 'radiogroup', 'aria-label': group.label}, ...rows), excerptView(group));
  }

  function conditionCard(group) {
    const d = draftOr();
    const on = d[group.id];
    const changed = state.draft && state.draft[group.id] !== state.applied[group.id];
    const canConfirm = !!d.day;
    return el('article', {class: 'group'}, groupHead(group, on ? kindTag('current') : kindTag('condition'), changed),
      el('p', {class: 'current-value', text: on ? 'Confirmed' : 'Not yet confirmed'}),
      el('p', {class: 'muted small', text: on ? 'The message now states the day as confirmed.' : `You said “${group.heard}.” This stays in the message until you change it here.`}),
      el('div', {class: 'button-row'},
        on ? el('button', {type: 'button', class: 'button small', disabled: !!state.preview, onclick: () => dispatch({type: 'SET', group: group.id, value: false}), text: 'Back to not confirmed'})
          : el('button', {type: 'button', class: 'button small', disabled: !canConfirm || !!state.preview, onclick: () => dispatch({type: 'SET', group: group.id, value: true}), text: 'Mark as confirmed'}),
        !on && !canConfirm ? el('span', {class: 'muted small', text: 'Choose a day first.'}) : null),
      excerptView(group));
  }

  function renderPanel() {
    const panel = $('review');
    panel.hidden = !state.open;
    if (!state.open) return;
    const sc = scenario();
    $('groups').replaceChildren(...sc.groups.map((g) => ({people: peopleCard, choice: choiceCard, options: optionsCard, condition: conditionCard}[g.kind](g))));
    const foot = $('review-foot');
    if (state.preview) {
      foot.replaceChildren(
        el('p', {class: 'preview-note'}, el('strong', {text: 'Preview. '}), RR.describeChanges(sc, state.applied, state.draft).join('; '), state.preview.overwritesEdit.length ? el('span', {class: 'warn', text: ' This replaces a phrase you edited by hand.'}) : null),
        el('div', {class: 'button-row'},
          el('button', {type: 'button', class: 'button primary', onclick: () => dispatch({type: 'APPLY'}), text: 'Apply'}),
          el('button', {type: 'button', class: 'button', onclick: () => dispatch({type: 'BACK'}), text: 'Keep editing'}),
          el('button', {type: 'button', class: 'button quiet', onclick: () => dispatch({type: 'CANCEL'}), text: 'Cancel'})));
    } else {
      foot.replaceChildren(
        el('p', {class: 'muted small', text: state.draft ? RR.describeChanges(sc, state.applied, state.draft).join('; ') : 'Change a decision, then preview the message.'}),
        el('div', {class: 'button-row'},
          el('button', {type: 'button', class: 'button primary', disabled: !state.draft, onclick: () => dispatch({type: 'PREVIEW'}), text: 'Preview change'}),
          el('button', {type: 'button', class: 'button quiet', disabled: !state.draft, onclick: () => dispatch({type: 'CANCEL'}), text: 'Cancel'})));
    }
  }

  function renderToast() {
    const t = $('r-toast');
    t.hidden = !ui.toast;
    if (!ui.toast) return;
    t.replaceChildren(...[el('span', {text: ui.toast.text}), ui.toast.undo && state.undo.length ? el('button', {type: 'button', class: 'button small', onclick: () => dispatch({type: 'UNDO'}), text: 'Undo'}) : null].filter(Boolean));
  }

  /* Phrase editor (shared component) */
  function startEdit() {
    ui.editing = true; ui.toast = null;
    if (state.open) dispatch({type: 'CLOSE'});
    ed.begin(RR.textOf(state), {});
  }
  function onEditorChange(action) {
    if (!ed.isEditing() && action.type !== 'APPLY') ui.editing = false;
    $('editor-panel').hidden = !ui.editing;
    render();
  }
  function onApply(change) {
    ui.editing = false;
    dispatch({type: 'TEXT_EDIT', before: change.before, start: change.start, end: change.end, removed: change.removed, inserted: change.inserted});
    ui.toast = {text: `Changed “${change.removed}” to “${change.inserted}”`, undo: true};
    ed.reset();
  }

  /* Side panel */
  const STEPS = {
    plain: [['No revisions, so no review control appears', () => true], ['Optional: edit a phrase', (ev) => ev.includes('text-edit')]],
    guests: [
      ['Open Review revisions', (ev) => ev.includes('open')],
      ['Check the source (none verified yet)', (ev, seen) => seen.has('source:guests')],
      ['Set Sam to Excluded', (ev) => ev.some((e) => e === 'set:guests.Sam=excluded')],
      ['Preview the message', (ev) => ev.includes('preview')],
      ['Apply it: Leo and Daniel keep their status', (ev) => ev.includes('apply')],
      ['Undo it', (ev) => ev.includes('undo')],
    ],
    schedule: [
      ['Open Review revisions', (ev) => ev.includes('open')],
      ['View the Date revisions', (ev, seen) => seen.has('history:day')],
      ['Restore Friday', (ev) => ev.includes('set:day=Friday')],
      ['Preview: time and guests stay', (ev) => ev.includes('preview')],
      ['Apply it', (ev) => ev.includes('apply')],
      ['Undo it', (ev) => ev.includes('undo')],
    ],
    unresolved: [
      ['Open Review revisions', (ev) => ev.includes('open')],
      ['Choose Thursday', (ev) => ev.includes('set:day=Thursday')],
      ['Apply: “don’t confirm” stays', (ev) => ev.includes('apply')],
      ['Mark as confirmed, a separate step', (ev) => ev.includes('set:confirmed=true')],
      ['Apply the confirmation', (ev) => ev.filter((e) => e === 'apply').length >= 2],
      ['Undo it', (ev) => ev.includes('undo')],
    ],
  };
  function renderChecklist() {
    let nowSet = false;
    $('r-checklist').replaceChildren(...STEPS[state.scenarioId].map(([label, done]) => {
      const isDone = done(state.events, ui.seen);
      const cls = isDone ? 'done' : nowSet ? '' : 'now';
      if (!isDone) nowSet = true;
      return el('li', {class: cls, text: label});
    }), el('li', {text: 'Also: Cancel and Reset work in every scenario'}));
  }

  function renderCheck() {
    const sc = scenario();
    const rendered = RR.joinSentences(sc.render(state.applied));
    const text = RR.textOf(state);
    const rows = [];
    if (state.manualEdits) rows.push(el('p', {}, el('span', {class: 'check-ok', text: '✓ '}), 'Hand edits kept. Cards show the decisions; your wording stays unless you change that decision.'));
    else rows.push(el('p', {}, el('span', {class: rendered === text ? 'check-ok' : 'check-bad', text: rendered === text ? '✓ Cards match the message. ' : '✗ Cards and message disagree. '}), 'The cards and the text come from the same decisions.'));
    rows.push(el('p', {}, el('span', {class: 'check-ok', text: '✓ Original output kept. '}), state.original === text ? 'The message is unchanged.' : 'Open “Original output” below the message to see it.'));
    $('r-check').replaceChildren(el('h3', {text: 'Message check'}), ...rows);
  }

  function renderScenario() {
    const sc = scenario();
    document.querySelectorAll('[data-scenario]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scenario === sc.id)));
    $('basis-tag').className = sc.basis === 'reconstruction' ? 'tag tag-unverified' : 'tag tag-sim';
    $('basis-tag').textContent = sc.basis === 'reconstruction' ? 'Reconstruction' : 'Scripted';
    $('basis-note').textContent = sc.basisNote;
    $('scenario-summary').textContent = sc.summary;
    $('spoken-wrap').hidden = !sc.input;
    $('spoken').textContent = sc.input ? `“${sc.input}”` : '';
  }

  function render() {
    renderScenario(); renderMessage(); renderPanel(); renderToast(); renderChecklist(); renderCheck();
    $('editor-panel').hidden = !ui.editing;
  }

  function setScenario(id) {
    ed.reset(); ui.editing = false; ui.toast = null;
    state = RR.createState(id);
    ui.history.clear(); ui.source = null; ui.seen.clear();
    const url = new URL(location.href);
    url.searchParams.set('scenario', id);
    history.replaceState(null, '', url);
    render();
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (params.has('record')) document.body.classList.add('record');
    ed = window.PhraseEditor.create({words: $('editor-words'), controls: $('editor-controls'), compact: true, onChange: onEditorChange, onApply});
    document.querySelectorAll('[data-scenario]').forEach((b) => b.addEventListener('click', () => setScenario(b.dataset.scenario)));
    $('review-control').addEventListener('click', () => dispatch({type: state.open ? 'CLOSE' : 'OPEN'}));
    $('edit-phrase').addEventListener('click', startEdit);
    $('editor-close').addEventListener('click', () => { ed.reset(); ui.editing = false; render(); });
    $('r-reset').addEventListener('click', () => dispatch({type: 'RESET'}));
    render();
  });
})();

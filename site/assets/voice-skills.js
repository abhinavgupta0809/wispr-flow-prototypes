/* Voice Skills page. Logic lives in skills-core.js (tested); sample data in skills-data.js. Tool
   connections, task history, discovery and every source item are simulated, and the page says so. */
(function () {
  const {el, storage} = window.WFP;
  const K = window.Skills;
  const D = window.SkillsData;
  const FS = window.FixStrip;
  const $ = (id) => document.getElementById(id);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TICK_MS = 850;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const pct = (n) => `${n.toFixed(1)}%`;
  const pts = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)} pts`;

  /* Shared, simulated state: connections and the skill registry */
  const conn = {...D.CONNECTIONS};
  let registry = clone(K.SAVED);
  const toolChip = (tool, detail) => el('span', {class: `tool tool-${tool}${conn[tool] ? '' : ' off'}`},
    el('b', {text: D.TOOL_NAMES[tool]}), detail ? ` ${detail}` : '', conn[tool] ? null : el('em', {text: ' · not connected'}));
  const inferredTag = (what) => el('span', {class: 'inferred', title: 'Inferred from your runs. Review before saving.', text: what || 'Inferred: review'});
  const windowLabel = (v) => (K.WINDOWS.find(([k]) => k === v) || [v, v])[1];
  const windowDetail = (v) => (v === 'since-last' ? `since your previous successful run (${D.LAST_RUN})` : v === '24h' ? 'the last 24 hours' : 'the last 7 days');

  function stepState(status) {
    return {pending: ['○', 'Waiting'], running: ['◐', 'Running'], done: ['✓', 'Done'], failed: ['✗', 'Failed'], stale: ['↻', 'Needs to run again'], cancelled: ['–', 'Cancelled']}[status];
  }

  /* ---------- The skill editor (used by the suggestion, templates and “Create a skill”) ---------- */
  function renderEditor(box, ctx) {
    const d = ctx.draft;
    const st = ctx.state || (ctx.state = {});
    const redraw = () => renderEditor(box, ctx);
    const field = (label, input, extra) => el('div', {class: 'field-wrap'}, el('label', {text: label}), extra || null, input);
    const text = (value, onInput, attrs = {}) => {
      const i = el(attrs.multiline ? 'textarea' : 'input', {type: attrs.multiline ? null : 'text', rows: attrs.rows || null, 'aria-label': attrs.label || null, placeholder: attrs.placeholder || ''});
      i.value = value || '';
      i.addEventListener('input', () => onInput(i.value));
      return i;
    };

    const nameIn = text(d.name, (v) => { d.name = v; }, {label: 'Skill name'});
    const cmdIn = text(d.command, (v) => { d.command = v.trim().toLowerCase(); st.conflict = null; st.error = null; spoken.textContent = K.validateCommand(d.command, []).ok ? `Say “${K.spokenForm(d.command)}”` : ''; ctx.onChange && ctx.onChange(); }, {label: 'Slash command'});
    cmdIn.id = `${ctx.key}-cmd`;
    const spoken = el('span', {class: 'hint', text: K.validateCommand(d.command, []).ok ? `Say “${K.spokenForm(d.command)}”` : ''});

    const sources = el('ul', {class: 'src-list'}, ...d.sources.map((s) => el('li', {}, toolChip(s.tool), ` ${s.detail} `, s.inferred ? inferredTag() : null,
      conn[s.tool] ? null : el('button', {type: 'button', class: 'button small', onclick: () => { conn[s.tool] = true; renderAll(); }, text: `Connect ${D.TOOL_NAMES[s.tool]} (simulated)`}))));
    if (!d.sources.length) sources.append(el('li', {class: 'muted', text: 'No sources yet. Add the steps first; each step names its tool.'}));

    const steps = el('ol', {class: 'step-edit'}, ...d.steps.map((s, i) => {
      const input = text(s.text, (v) => { s.text = v; }, {label: `Step ${i + 1}`});
      const move = (dir) => { const j = i + dir; [d.steps[i], d.steps[j]] = [d.steps[j], d.steps[i]]; redraw(); };
      return el('li', {},
        s.tool ? toolChip(s.tool) : el('span', {class: 'tool tool-none', text: 'Flow'}), input,
        el('span', {class: 'step-btns'},
          el('button', {type: 'button', class: 'icon-btn', 'aria-label': `Move step ${i + 1} up`, disabled: i === 0, onclick: () => move(-1), text: '↑'}),
          el('button', {type: 'button', class: 'icon-btn', 'aria-label': `Move step ${i + 1} down`, disabled: i === d.steps.length - 1, onclick: () => move(1), text: '↓'}),
          el('button', {type: 'button', class: 'icon-btn', 'aria-label': `Remove step ${i + 1}`, onclick: () => { d.steps.splice(i, 1); redraw(); }, text: '×'})));
    }));
    const addIn = el('input', {type: 'text', placeholder: 'Add a step, e.g. “Mention anything waiting on design”', 'aria-label': 'New step'});
    const add = () => { if (!addIn.value.trim()) return; d.steps.push({id: `custom-${d.steps.length + 1}`, text: addIn.value.trim(), tool: null, uses: ['focus']}); redraw(); };
    addIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });

    const inputs = el('div', {class: 'inputs-edit'});
    if (d.inputs.window) {
      const sel = el('select', {'aria-label': 'Reporting window'}, ...K.WINDOWS.map(([k, l]) => el('option', {value: k, text: l})));
      sel.value = d.inputs.window.value;
      sel.addEventListener('change', () => { d.inputs.window.value = sel.value; d.inputs.window.confirmed = true; ctx.onChange && ctx.onChange(); redraw(); });
      inputs.append(field('Reporting window (changes each run)', sel, el('span', {class: 'hint'}, d.inputs.window.inferred && !d.inputs.window.confirmed ? inferredTag() : null, ' ', d.inputs.window.note || '')));
    }
    Object.entries(d.inputs).filter(([k]) => k !== 'window').forEach(([k, v]) => {
      inputs.append(el('p', {class: 'muted small'}, el('strong', {text: `${cap(k)}: `}), v.note || (v.required ? 'Asked for if you don’t say it.' : 'Optional; say it after the command.')));
    });

    const qs = K.setupQuestions(d);
    const questions = qs.length ? el('div', {class: 'questions'}, el('h4', {text: `${qs.length} question${qs.length > 1 ? 's' : ''} Flow couldn’t answer from your runs`}),
      ...qs.map((q) => q.freeText ? el('div', {class: 'question'}, el('p', {class: 'q', text: q.question}),
        el('div', {class: 'add-step'}, (() => { const i = el('input', {type: 'text', 'aria-label': q.question, placeholder: 'Your answer'}); i.addEventListener('keydown', (e) => { if (e.key === 'Enter' && i.value.trim()) { d.answers = {...(d.answers || {}), [q.key]: i.value.trim()}; redraw(); } }); return i; })(),
          el('button', {type: 'button', class: 'button small', onclick: (e) => { const v = e.target.previousSibling.value.trim(); if (v) { d.answers = {...(d.answers || {}), [q.key]: v}; redraw(); } }, text: 'Answer'})))
      : el('div', {class: 'question'}, el('p', {class: 'q', text: q.question}),
        q.key === 'threshold' ? field('Metrics', text(d.metrics.value, (v) => { d.metrics.value = v; }, {label: 'Metrics to highlight'}), el('span', {class: 'hint', text: 'Prefilled from your runs. Edit if needed.'})) : null,
        el('div', {class: 'pills'}, ...q.options.map((o) => {
          const [val, label] = Array.isArray(o) ? o : [o, o];
          return el('button', {type: 'button', class: 'button small', onclick: () => {
            if (q.key === 'window') { d.inputs.window.value = val; d.inputs.window.confirmed = true; }
            if (q.key === 'threshold') { d.metrics.threshold = parseInt(val, 10); }
            ctx.onChange && ctx.onChange(); redraw();
          }, text: label});
        }))))) : el('p', {class: 'muted small', text: 'No open questions. Everything else came from your runs; review the marked settings.'});

    const answered = [];
    if (d.inputs.window && d.inputs.window.confirmed) answered.push(`Window: ${windowLabel(d.inputs.window.value)}`);
    if (d.metrics && d.metrics.threshold) answered.push(`Highlight changes of ${d.metrics.threshold} point${d.metrics.threshold > 1 ? 's' : ''} or more in ${d.metrics.value}`);
    (d.questions || []).forEach((q, i) => { if (d.answers && d.answers[`q${i}`]) answered.push(`${q} ${d.answers[`q${i}`]}`); });

    const completion = el('div', {class: 'pills', role: 'radiogroup', 'aria-label': 'Completion behavior'}, ...K.COMPLETIONS.map(([k, l]) => {
      const i = el('input', {type: 'radio', name: `${ctx.key}-completion`, value: k, checked: d.completion.value === k});
      i.addEventListener('change', () => { d.completion.value = k; d.completion.inferred = false; redraw(); });
      return el('label', {class: 'pill'}, i, el('span', {text: l}));
    }));

    const conflict = st.conflict ? el('div', {class: 'conflict', role: 'alert'},
      el('p', {}, el('strong', {text: `${st.conflict.command} already runs “${st.conflict.name}.” `}), 'Choose another name, or update that skill on purpose.'),
      el('div', {class: 'button-row'},
        el('button', {type: 'button', class: 'button small', onclick: () => { $(`${ctx.key}-cmd`).focus(); $(`${ctx.key}-cmd`).select(); }, text: 'Choose another name'}),
        el('button', {type: 'button', class: 'button small', onclick: () => { d.id = st.conflict.id; st.conflict = null; save(); }, text: `Update ${st.conflict.command}`}))) : null;

    function save() {
      const v = K.validateCommand(d.command, registry, d.id);
      if (!d.name.trim()) { st.error = 'Give the skill a name.'; redraw(); return; }
      if (v.conflict) { st.conflict = v.conflict; redraw(); return; }
      if (!v.ok) { st.error = v.error; redraw(); return; }
      if (!d.steps.length) { st.error = 'Add at least one step.'; redraw(); return; }
      const skill = clone({...d, id: d.id || d.command.slice(1)});
      skill.sources = [...new Set(skill.steps.filter((s) => s.tool).map((s) => s.tool))].map((t) => d.sources.find((s) => s.tool === t) || {tool: t, detail: ''});
      registry = registry.filter((s) => s.id !== skill.id).concat(skill);
      ctx.onSaved(skill);
      renderAll();
    }

    function trySample() {
      const skill = {...clone(d), id: 'trial'};
      let r = K.createRun(skill, {focus: 'onboarding', window: d.inputs.window ? d.inputs.window.value : '24h', threshold: (d.metrics && d.metrics.threshold) || 2}, {unavailable: Object.keys(conn).filter((t) => !conn[t])});
      for (let i = 0; i < 60 && r.phase === 'running'; i++) r = K.reduceRun(r, {type: 'TICK'});
      const lines = r.steps.map((s) => `${stepState(s.status)[0]} ${s.text}${s.status === 'failed' ? ` (${D.TOOL_NAMES[s.tool]} isn’t connected)` : ''}`);
      if (ctx.mode === 'suggestion') {
        const b = K.buildBrief(r);
        if (b.theme) lines.push(`→ Theme found: ${b.theme.title} (${b.theme.emails} emails, ${b.theme.slack} Slack messages).`);
        if (b.metric) lines.push(`→ Metrics read: ${b.metric.map((m) => m.name).join(', ')}.`);
      }
      lines.push(`→ Output: ${d.output}`, `→ Would go to: ${d.destination.value} (${K.COMPLETIONS.find(([k]) => k === d.completion.value)[1].toLowerCase()}). Nothing is posted in a trial.`);
      st.trial = lines;
      redraw();
    }

    box.replaceChildren(...[
      el('div', {class: 'editor-head'}, el('h3', {text: ctx.title}), ctx.subtitle ? el('p', {class: 'muted', text: ctx.subtitle}) : null),
      el('div', {class: 'editor-grid'},
        field('Name', nameIn),
        field('Slash command', cmdIn, spoken)),
      conflict,
      st.error ? el('p', {class: 'form-error', role: 'alert', text: st.error}) : null,
      el('div', {class: 'editor-sec'}, el('h4', {text: 'Sources'}), sources),
      el('div', {class: 'editor-sec'}, el('h4', {text: 'Steps, in order'}), steps, el('div', {class: 'add-step'}, addIn, el('button', {type: 'button', class: 'button small', onclick: add, text: 'Add step'}))),
      el('div', {class: 'editor-sec'}, el('h4', {text: 'Changing inputs'}), inputs),
      el('div', {class: 'editor-sec'}, questions, answered.length ? el('p', {class: 'answered'}, el('strong', {text: 'Answered: '}), answered.join(' · ')) : null),
      el('div', {class: 'editor-grid'},
        field('Output', text(d.output, (v) => { d.output = v; }, {multiline: true, rows: 2, label: 'Output'})),
        field('Destination', text(d.destination.value, (v) => { d.destination.value = v; d.destination.inferred = false; }, {label: 'Destination'}), d.destination.inferred ? el('span', {class: 'hint'}, inferredTag('Inferred destination: check it')) : null)),
      el('div', {class: 'editor-sec'}, el('h4', {text: 'When it finishes'}), completion, d.completion.inferred ? el('p', {class: 'hint'}, inferredTag(), ' You approved each draft before it was posted.') : null),
      st.trial ? el('div', {class: 'trial'}, el('div', {class: 'button-row'}, el('span', {class: 'tag tag-sim', text: 'Trial with sample data'})), el('ul', {class: 'plain'}, ...st.trial.map((l) => el('li', {text: l})))) : null,
      el('div', {class: 'button-row editor-actions'},
        el('button', {type: 'button', class: 'button', onclick: trySample, text: 'Try with sample data'}),
        el('button', {type: 'button', class: 'button primary', onclick: save, text: 'Save skill'}),
        el('button', {type: 'button', class: 'button quiet', onclick: ctx.onCancel, text: 'Cancel'}))].filter(Boolean));
  }

  /* ---------- Shared run view ---------- */
  function stepDetail(run, s) {
    const f = run.inputs.focus || 'onboarding';
    if (s.status === 'failed') return s.tool === 'excel' && conn.excel ? 'Couldn’t open Onboarding KPIs.xlsx: the workbook is unavailable.' : `${D.TOOL_NAMES[s.tool]} isn’t connected.`;
    if (s.status === 'stale') return `Ran with an earlier input. Needs to run again for “${f}.”`;
    if (s.status === 'running') return s.tool ? `Reading ${D.TOOL_NAMES[s.tool]}…` : 'Preparing…';
    if (s.status !== 'done') return stepState(s.status)[1];
    if (run.skillId === 'prs' || run.skillId === 'dev') {
      return {github: `${D.PRS.length} pull requests await your review in ${run.inputs.repo}`, ci: `${D.PRS.filter((p) => p.ci === 'passing').length} passing, ${D.PRS.filter((p) => p.ci === 'failing').length} failing, ${D.PRS.filter((p) => p.ci === 'pending').length} pending`, slack: '2 threads mention release blockers', order: 'Queue ordered', draft: 'Status update drafted (not posted)'}[s.id] || 'Done';
    }
    return {gmail: `${D.PM_SOURCES.gmail.filter((m) => m.focus === f).length} new emails about ${f}`, slack: `${D.PM_SOURCES.slack.filter((m) => m.focus === f).length} new messages about ${f}`, excel: `${D.PM_SOURCES.excel.metrics.filter((m) => m.focus === f).length} metrics, Oct 14 → Oct 15`}[s.id] || 'Done';
  }

  function runView(run, pre) {
    return el('div', {class: 'run'},
      el('ol', {class: 'run-steps'},
        ...pre.map(([ok, label]) => el('li', {class: ok ? 'done' : 'ask'}, el('span', {class: 'st', text: ok ? '✓' : '?'}), el('span', {class: 'lbl', text: label}))),
        ...run.steps.map((s) => el('li', {class: s.status},
          el('span', {class: 'st', 'aria-hidden': 'true', text: stepState(s.status)[0]}),
          el('span', {class: 'lbl'}, s.tool ? toolChip(s.tool) : el('span', {class: 'tool tool-none', text: 'Flow'}), ` ${s.text}`),
          el('span', {class: 'det', text: stepDetail(run, s)})))),
      el('p', {class: `run-status ph-${run.phase}`, role: 'status', text: K.statusLine(run, D.TOOL_NAMES)}));
  }

  /* ================= Product manager demo: discovery to execution ================= */
  const pm = {};
  let cmdEd;
  let cmdWords;
  let cmdControls;
  function pmReset() {
    clearInterval(pm.timer);
    Object.assign(pm, {history: clone(D.HISTORY), prefs: {}, stage: 'history', draft: null, editor: null, skill: null, utter: null, parsed: null, interp: null, plain: null,
      unavailable: false, run: null, timer: null, draftText: '', replyText: '', flags: new Set(), impact: null, postNote: null, posts: []});
    registry = registry.filter((s) => s.id !== 'morning' && !(s.basedOn && s.basedOn.length));
    if (cmdEd) cmdEd.reset();
  }

  const PM_STEPS = [
    ['three', 'Three morning-brief runs completed'],
    ['suggested', 'Flow suggests saving it as a skill'],
    ['editor', 'Open the inferred skill'],
    ['edited', 'Change the reporting window and rename it /morning'],
    ['saved', 'Save the skill'],
    ['dictated', 'Say “slash morning, focus on onboarding”'],
    ['matched', 'See the matched skill and its inputs'],
    ['progress', 'Watch each source run'],
    ['brief', 'Read the brief and the Slack draft'],
    ['posted', 'Edit the draft and post it'],
  ];
  function pmStepper() {
    let nowSet = false;
    $('pm-steps').replaceChildren(...PM_STEPS.map(([k, label]) => {
      const done = pm.flags.has(k);
      const cls = done ? 'done' : nowSet ? '' : 'now';
      if (!done) nowSet = true;
      return el('li', {class: cls, text: label});
    }));
  }

  function pmHistory() {
    const sig = 'morning-brief';
    const s = K.suggestionState(pm.history, sig, pm.prefs);
    if (s.n >= 3) pm.flags.add('three');
    if (s.show) pm.flags.add('suggested');
    const rows = pm.history.map((r) => {
      const why = r.signature !== sig ? 'Different workflow, not counted' : K.whyNotCounted(r);
      const counts = !why;
      return el('li', {class: `hist${counts ? ' counts' : ''}`},
        el('span', {class: 'when', text: r.when}),
        el('span', {class: 'req', text: r.request}),
        r.status === 'ready'
          ? el('span', {class: 'hstat'}, el('span', {class: 'badge wait', text: 'Draft ready for review'}), el('button', {type: 'button', class: 'button small primary', onclick: () => { pm.history = pm.history.map((x) => (x.id === r.id ? {...x, status: 'completed', accepted: true} : x)); pmRender(); }, text: 'Accept draft'}))
          : el('span', {class: `badge ${counts ? 'ok' : 'no'}`, text: counts ? 'Completed and accepted · counts' : why}));
    });
    const sug = s.show ? el('div', {class: 'suggestion', role: 'status'},
      el('p', {class: 'sug-title', text: 'You’ve created this morning brief three times. Save it as a skill?'}),
      el('p', {text: 'Review customer emails, summarize the onboarding workbook, and draft an update for Slack.'}),
      el('div', {class: 'button-row'},
        el('button', {type: 'button', class: 'button primary', onclick: () => { pm.draft = K.inferDraft(pm.history); pm.editor = {key: 'pm-ed'}; pm.stage = 'editor'; pm.flags.add('editor'); pmRender(); }, text: 'Review suggestion'}),
        el('button', {type: 'button', class: 'button', onclick: () => { pm.prefs.snoozedAt = s.n; pmRender(); }, text: 'Not now'}),
        el('button', {type: 'button', class: 'button quiet', onclick: () => { pm.prefs.never = true; pmRender(); }, text: 'Don’t suggest this again'})),
      el('p', {class: 'muted small', text: 'Nothing is saved or bound to a command until you accept. Based on your Flow task history only (simulated).'})) : null;
    const note = s.reason === 'snoozed' ? el('p', {class: 'muted small'}, 'Suggestion hidden for now. It can come back after your next similar run. ', el('button', {type: 'button', class: 'link', onclick: () => { delete pm.prefs.snoozedAt; pmRender(); }, text: 'Show it again (demo)'}))
      : s.reason === 'never' ? el('p', {class: 'muted small'}, 'Flow won’t suggest this workflow again. ', el('button', {type: 'button', class: 'link', onclick: () => { delete pm.prefs.never; pmRender(); }, text: 'Undo'})) : null;
    return el('div', {class: 'stage'},
      el('div', {class: 'stage-head'}, el('h3', {text: 'Your recent Flow tasks'}), el('span', {class: 'counter', text: `Similar morning briefs that count: ${Math.min(s.n, 3)} of ${K.SUGGEST_AFTER}`})),
      sug, note,
      el('ul', {class: 'history'}, ...rows),
      el('p', {class: 'muted small', text: 'A run counts when you completed and accepted the same process. Retries, cancelled runs and other tasks don’t. Dates and other inputs can differ.'}));
  }

  function pmEditor() {
    const box = el('div', {class: 'stage editor'});
    const d = pm.draft;
    renderEditor(box, Object.assign(pm.editor, {
      draft: d, mode: 'suggestion',
      title: 'Review the suggested skill',
      subtitle: `Built from your runs on ${pm.history.filter((r) => d.basedOn.includes(r.id)).map((r) => r.when.split(',').slice(0, 2).join(',')).join('; ')}. Marked settings were inferred.`,
      onChange: () => { if (d.command === '/morning' && d.inputs.window.confirmed) pm.flags.add('edited'); pmStepper(); },
      onSaved: (skill) => { pm.skill = skill; pm.stage = 'saved'; pm.flags.add('saved'); if (skill.command === '/morning' && skill.inputs.window.confirmed) pm.flags.add('edited'); pmRender(); },
      onCancel: () => { pm.stage = 'history'; pmRender(); },
    }));
    return box;
  }

  function pmSaved() {
    const sk = pm.skill;
    return el('div', {class: 'stage'},
      el('div', {class: 'saved-banner', role: 'status'}, el('strong', {text: `${sk.name} is ready.`}), ` Say “${K.spokenForm(sk.command)}” to run it.`),
      el('div', {class: 'skill-card'}, el('span', {class: 'skill-chip', text: sk.command}), el('span', {text: ` ${sk.name}`}),
        el('p', {class: 'muted small', text: `${sk.steps.length} steps · ${windowLabel(sk.inputs.window.value)} · ${sk.destination.value} · ${K.COMPLETIONS.find(([k]) => k === sk.completion.value)[1]}`})),
      el('div', {class: 'button-row'}, el('button', {type: 'button', class: 'button primary', onclick: () => { pm.stage = 'invoke'; pmRender(); }, text: 'Use it now'})));
  }

  /* Invocation */
  function utterances() {
    const say = pm.skill ? cap(K.spokenForm(pm.skill.command)) : 'Slash morning';
    return [
      {id: 'onboarding', label: 'Run with a focus', text: `${say}, focus on onboarding.`},
      {id: 'activation', label: 'Misheard input', text: `${say}, focus on activation.`, highlights: [{phrase: 'activation', alternatives: ['retention', 'activity'], repeat: 'retention'}]},
      {id: 'unknown', label: 'Unknown command', text: 'Slash standup, keep it short.'},
      {id: 'ordinary', label: 'Ordinary dictation', text: 'I’ll send the morning brief after lunch.'},
    ];
  }

  function dictate(u) {
    clearInterval(pm.timer);
    pm.run = null; pm.impact = null; pm.plain = null; pm.postNote = null;
    cmdEd.reset();
    cmdEd.dispatch({type: 'LOAD', text: u.text, highlights: u.highlights || []});
    pm.flags.add(u.id === 'onboarding' || u.id === 'activation' ? 'dictated' : 'tried-other');
    parse();
  }

  function parse() {
    const text = cmdEd.state.text;
    pm.parsed = K.parseInvocation(text, registry);
    pm.interp = pm.parsed.kind === 'skill' ? K.interpret(pm.parsed.skill, pm.parsed.rest) : null;
    if (pm.parsed.kind === 'skill' && pm.parsed.skill.id === (pm.skill && pm.skill.id)) pm.flags.add('matched');
  }

  function commandLine() {
    const s = cmdEd.state;
    if (!s.text) return el('p', {class: 'cmd-empty', text: 'Choose a prepared dictation, or type a command.'});
    const marked = cmdEd.textNodes();
    if (marked) return el('p', {class: 'cmd-text pe-text'}, ...marked);
    const p = pm.parsed;
    const nodes = [];
    let from = 0;
    if (p && (p.kind === 'skill' || p.kind === 'unknown')) {
      const triggerLen = s.text.indexOf(p.trigger) + p.trigger.length;
      nodes.push(el('span', {class: `skill-chip${p.kind === 'unknown' ? ' unknown' : ''}`, title: p.kind === 'skill' ? 'Recognized skill trigger' : 'Not a saved skill'},
        p.kind === 'skill' ? `${p.command} · ${p.skill.name}` : `${p.command} · unknown`), ' ');
      from = triggerLen;
    }
    const open = FS.openHighlights(s).filter((h) => h.start >= from).sort((a, b) => a.start - b.start);
    let at = from;
    open.forEach((h) => {
      nodes.push(s.text.slice(at, h.start).replace(/^\s+/, ''));
      nodes.push(el('button', {type: 'button', class: 'uncertain', title: FS.HIGHLIGHT_LABEL, 'aria-label': `${FS.HIGHLIGHT_LABEL}: ${h.phrase}`, onclick: () => cmdEd.dispatch({type: 'OPEN_HIGHLIGHT', id: h.id}), text: s.text.slice(h.start, h.end)}));
      at = h.end;
    });
    nodes.push(at === from ? s.text.slice(at).replace(/^\s+/, '') : s.text.slice(at));
    return el('p', {class: 'cmd-text'}, ...nodes);
  }

  function interpretation() {
    const p = pm.parsed;
    if (!p) return null;
    if (pm.plain) return el('div', {class: 'interp neutral'}, el('p', {}, el('strong', {text: 'Inserted as text. '}), `“${pm.plain}” Nothing ran.`));
    if (p.kind === 'text') return el('div', {class: 'interp neutral'}, el('p', {}, el('strong', {text: 'Ordinary dictation. '}), 'There’s no command at the start, so it’s inserted as text and nothing runs, even though it mentions a brief.'));
    if (p.kind === 'unknown') {
      return el('div', {class: 'interp warn'},
        el('p', {}, el('strong', {text: `No skill called ${p.command}. `}), 'Nothing will run. Flow won’t guess a workflow.'),
        el('div', {class: 'button-row'},
          el('details', {class: 'choose'}, el('summary', {class: 'button small', text: 'Choose a skill'}),
            el('ul', {class: 'plain'}, ...registry.map((s) => el('li', {}, el('button', {type: 'button', class: 'link', onclick: () => { cmdEd.reset(); cmdEd.dispatch({type: 'LOAD', text: `${cap(K.spokenForm(s.command))}, ${p.rest}`}); parse(); pmRender(); }, text: `${s.command} · ${s.name}`}))))),
          el('button', {type: 'button', class: 'button small', onclick: () => { createFromCommand(p.command); }, text: 'Create a skill'}),
          el('button', {type: 'button', class: 'button small', onclick: () => { pm.plain = cmdEd.state.text; pmRender(); }, text: 'Keep as text'})));
    }
    const sk = p.skill;
    const inp = pm.interp.inputs;
    const focusMarked = FS.openHighlights(cmdEd.state).some((h) => cmdEd.state.text.slice(h.start, h.end).toLowerCase() === inp.focus);
    const rows = [
      ['Skill', `${sk.name} (${sk.command}), ${p.via === 'typed' ? 'typed' : 'spoken'}`],
      ['Focus', inp.focus ? inp.focus + (focusMarked ? ' · marked “Check this phrase”' : '') : 'none (covers everything)'],
      ['Window', sk.inputs.window ? cap(windowDetail(sk.inputs.window.value)) : '—'],
      ['Destination', `${sk.destination.value}. ${sk.completion.value === 'post' ? 'Posted automatically.' : 'Nothing is posted until you approve.'}`],
    ];
    const running = pm.run && pm.run.phase === 'running';
    return el('div', {class: 'interp'},
      el('dl', {}, ...rows.map(([k, v]) => el('div', {}, el('dt', {text: k}), el('dd', {text: v})))),
      focusMarked ? el('p', {class: 'muted small', text: 'Tap the underlined word to check it before running. You only repeat that word, not the command.'}) : null,
      pm.run ? null : el('div', {class: 'button-row'},
        el('button', {type: 'button', class: 'button primary', onclick: startRun, text: `Run ${sk.command}`}),
        el('label', {class: 'inline-check'}, el('input', {type: 'checkbox', checked: pm.unavailable, onchange: (e) => { pm.unavailable = e.target.checked; }}), ' Simulate: workbook unavailable'),
        el('button', {type: 'button', class: 'button quiet', onclick: () => { cmdEd.reset(); pm.parsed = null; pmRender(); }, text: 'Clear'})),
      running ? el('div', {class: 'button-row'}, el('button', {type: 'button', class: 'button small', onclick: () => cmdEd.dispatch({type: 'OPEN_STRIP'}), text: 'Change a word in the command'})) : null);
  }

  function createFromCommand(command) {
    pm.draft = {id: null, name: '', command, basedOn: [], sources: [], steps: [], inputs: {}, metrics: null, output: '', destination: {value: 'Private'}, completion: {value: 'draft'}};
    pm.editor = {key: 'pm-new'};
    pm.stage = 'create';
    pmRender();
  }

  function startRun() {
    const sk = pm.parsed.skill;
    const inputs = {...pm.interp.inputs, window: sk.inputs.window ? sk.inputs.window.value : undefined, threshold: (sk.metrics && sk.metrics.threshold) || 2};
    const unavailable = [...Object.keys(conn).filter((t) => !conn[t]), ...(pm.unavailable ? ['excel'] : [])];
    pm.run = K.createRun(sk, inputs, {unavailable, sections: ['feedback', 'metrics']});
    pm.draftText = ''; pm.replyText = ''; pm.postNote = null; pm.impact = null; pm.posts = [];
    pm.flags.add('progress');
    tickLoop();
    pmRender();
  }

  function tickLoop() {
    clearInterval(pm.timer);
    const step = () => {
      pm.run = K.reduceRun(pm.run, {type: 'TICK'});
      if (pm.run.phase !== 'running') clearInterval(pm.timer);
      if (['ready', 'partial'].includes(pm.run.phase)) pm.flags.add('brief');
      if (!cmdEd.isEditing()) pmRender();
    };
    if (reduceMotion()) { while (pm.run.phase === 'running') pm.run = K.reduceRun(pm.run, {type: 'TICK'}); step(); return; }
    pm.timer = setInterval(step, TICK_MS);
  }

  /* After the command text is repaired: re-read it, and if a run exists, tell it what changed. */
  function onCommandRepaired() {
    const before = pm.interp && pm.interp.inputs.focus;
    parse();
    const after = pm.interp && pm.interp.inputs.focus;
    if (pm.run && after !== undefined && after !== before && !['cancelled'].includes(pm.run.phase)) {
      pm.run = K.reduceRun(pm.run, {type: 'CHANGE_INPUT', key: 'focus', value: after});
      const name = (id) => (pm.run.steps.find((s) => s.id === id) || {}).text || id;
      const by = (e) => pm.run.impact.filter((x) => x.effect === e).map((x) => x.step);
      pm.impact = {from: before, to: after, rerun: by('rerun').map(name), restart: by('restart').map(name), upcoming: by('upcoming').map(name)};
      pm.draftText = ''; pm.replyText = '';
      if (pm.run.phase === 'running') tickLoop();
    }
    pmRender();
  }

  function impactNote() {
    const im = pm.impact;
    if (!im) return null;
    const list = (arr) => el('ul', {class: 'plain small'}, ...arr.map((t) => el('li', {text: t})));
    return el('div', {class: 'impact', role: 'status'},
      el('p', {}, el('strong', {text: `Focus changed: “${im.from}” → “${im.to}”. `})),
      im.rerun.length ? el('div', {}, el('p', {class: 'small', text: 'Already finished with the old value, so they must run again:'}), list(im.rerun)) : null,
      im.restart.length ? el('div', {}, el('p', {class: 'small', text: 'Was running; restarting with the new value:'}), list(im.restart)) : null,
      im.upcoming.length ? el('div', {}, el('p', {class: 'small', text: 'Hadn’t started; will use the new value:'}), list(im.upcoming)) : null,
      pm.run.phase === 'stale' ? el('div', {class: 'button-row'}, el('button', {type: 'button', class: 'button small primary', onclick: () => { pm.run = K.reduceRun(pm.run, {type: 'RERUN_STALE'}); tickLoop(); pmRender(); }, text: 'Run those steps again'})) : null);
  }

  function briefText(b) {
    const lines = [`Morning brief, ${D.TODAY.replace(/, 2026$/, '')}${b.focus ? ` (focus: ${b.focus})` : ''}`];
    if (b.theme) lines.push(`• Customer theme: ${b.theme.title} (${b.theme.emails} emails, ${b.theme.slack} Slack messages).`);
    else if (b.missing.includes('gmail') || b.missing.includes('slack')) lines.push('• Customer feedback: not included this time.');
    if (b.metric) {
      const flagged = b.metric.filter((m) => m.flagged);
      lines.push(flagged.length ? `• Metric: ${flagged.map((m) => `${m.name} ${m.delta > 0 ? 'rose' : 'fell'} ${Math.abs(m.delta).toFixed(1)} pts (${pct(m.prev)} → ${pct(m.now)}, Oct 14 → Oct 15). Cause not established.`).join(' ')}` : '• Metrics: no change at or above the threshold.');
    } else lines.push('• Dashboard: not included. The workbook was unavailable; follow-up to come.');
    if (b.question) lines.push(`• Open question: ${b.question}`);
    return lines.join('\n');
  }
  function metricsReplyText(b) {
    const flagged = b.metric.filter((m) => m.flagged);
    return `Dashboard follow-up: ${flagged.length ? flagged.map((m) => `${m.name} ${m.delta > 0 ? 'rose' : 'fell'} ${Math.abs(m.delta).toFixed(1)} pts (${pct(m.prev)} → ${pct(m.now)}, Oct 14 → Oct 15). Cause not established.`).join(' ') : 'no change at or above the threshold.'}`;
  }

  function resultView() {
    const r = pm.run;
    if (!['ready', 'partial', 'completed'].includes(r.phase)) return null;
    const b = K.buildBrief(r);
    if (!pm.draftText) pm.draftText = briefText(b);
    const srcLink = (id) => el('a', {href: `#src-${id}`, class: 'src-link', onclick: () => { const d = $('pm-sources'); if (d) d.open = true; }, text: id.startsWith('g') ? `email ${id.slice(1)}` : `Slack ${id.slice(1)}`});
    const posted = (sec) => r.posted.includes(sec);
    const sections = el('div', {class: 'brief'},
      el('div', {class: 'brief-head'}, el('h4', {text: `${pm.skill ? pm.skill.name : 'Brief'} · ${D.TODAY}`}), el('span', {class: 'muted small', text: `Focus: ${b.focus} · covers ${windowDetail(r.inputs.window || 'since-last')}`})),
      el('section', {}, el('h5', {text: 'Customer theme'}),
        b.theme ? el('p', {}, el('strong', {text: b.theme.title}), ` · ${b.theme.emails} emails and ${b.theme.slack} Slack messages. Sources: `, ...b.theme.sources.flatMap((id, i) => [i ? ', ' : '', srcLink(id)])) : el('p', {class: 'muted', text: 'No customer sources were read.'})),
      el('section', {}, el('h5', {text: 'Metric changes (observed)'}),
        b.metric ? el('ul', {class: 'plain'}, ...b.metric.map((m) => el('li', {class: m.flagged ? 'flag' : ''}, `${m.name}: ${pct(m.prev)} → ${pct(m.now)} (${pts(m.delta)}, Oct 14 → Oct 15) `, el('span', {class: 'badge ' + (m.flagged ? 'warnb' : 'no'), text: m.flagged ? 'At or above threshold' : 'Below threshold'}))))
          : el('div', {class: 'failure'}, el('p', {}, el('strong', {text: 'Customer feedback is ready. The dashboard summary couldn’t run because the workbook is unavailable.'})),
            el('div', {class: 'button-row'},
              el('button', {type: 'button', class: 'button small primary', onclick: () => { pm.run = K.reduceRun(pm.run, {type: 'RETRY', fixed: true}); pm.unavailable = false; if (!pm.run.posted.length) pm.draftText = ''; tickLoop(); pmRender(); }, text: 'Retry the dashboard step'}),
              el('span', {class: 'muted small', text: 'Retrying re-reads only the workbook. Nothing already posted is posted again.'})))),
      b.metric && b.metric.some((m) => m.flagged) ? el('section', {}, el('h5', {text: 'Possible explanations (not established)'}),
        el('p', {class: 'muted', text: b.focus === 'onboarding' ? 'Invites landing in spam could stop invitees from finishing setup. Nothing in these sources shows that it did; the dashboard alone can’t establish a cause.' : 'These sources don’t point to a cause.'})) : null,
      el('section', {}, el('h5', {text: 'Open question'}), el('p', {text: b.question || '—'})),
      el('details', {class: 'sources', id: 'pm-sources'}, el('summary', {text: 'Sources used (sample data)'}),
        el('ul', {class: 'plain small'}, ...[...D.PM_SOURCES.gmail, ...D.PM_SOURCES.slack].filter((m) => m.focus === b.focus).map((m) => el('li', {id: `src-${m.id}`},
          el('strong', {text: m.from ? `Email · ${m.from}: ` : `Slack ${m.channel} · ${m.author}: `}), m.subject ? `“${m.subject}” ` : '', el('span', {class: 'muted', text: m.snippet || m.text}))))));

    const ta = el('textarea', {rows: 6, 'aria-label': 'Slack draft', spellcheck: 'true'});
    ta.value = pm.draftText;
    ta.addEventListener('input', () => { pm.draftText = ta.value; pm.flags.add('draft-edited'); });
    const channel = (pm.skill && pm.skill.destination.value.match(/#[\w-]+/)) ? pm.skill.destination.value.match(/#[\w-]+/)[0] : '#product-onboarding';
    const actions = [];
    if (!posted('feedback')) {
      actions.push(el('button', {type: 'button', class: 'button primary', onclick: () => { const secs = r.phase === 'partial' ? ['feedback'] : ['feedback', 'metrics']; pm.run = K.reduceRun(pm.run, {type: 'POST', sections: secs}); pm.posts = [...(pm.posts || []), {text: pm.draftText, reply: false}]; pm.flags.add('posted'); pmRender(); },
        text: r.phase === 'partial' ? `Post what’s ready to ${channel} (simulated)` : `Post to ${channel} (simulated)`}));
    } else if (r.phase === 'ready' && !posted('metrics')) {
      if (!pm.replyText) pm.replyText = metricsReplyText(b);
      actions.push(el('button', {type: 'button', class: 'button primary', onclick: () => { pm.run = K.reduceRun(pm.run, {type: 'POST', sections: ['feedback', 'metrics']}); pm.posts = [...pm.posts, {text: pm.replyText, reply: true}]; pmRender(); }, text: 'Post the dashboard summary as a thread reply'}));
    } else {
      actions.push(el('button', {type: 'button', class: 'button', onclick: () => { pm.run = K.reduceRun(pm.run, {type: 'POST', sections: ['feedback', 'metrics']}); pm.postNote = 'Already posted. Nothing was sent twice.'; pmRender(); }, text: 'Post again'}));
    }
    return el('div', {class: 'result'},
      sections,
      el('div', {class: 'slack-draft'},
        el('div', {class: 'button-row'}, toolChip('slack', `${channel} · draft`), el('span', {class: 'tag tag-sim', text: 'Simulated destination'})),
        posted('feedback') ? el('p', {class: 'muted small', text: 'Posted text is shown below; the draft is locked.'}) : ta,
        el('div', {class: 'button-row'}, ...actions),
        pm.postNote ? el('p', {class: 'post-note', role: 'status', text: pm.postNote}) : null,
        (pm.posts || []).length ? el('div', {class: 'channel'}, el('p', {class: 'muted small', text: `${channel} (simulated)`}),
          ...pm.posts.map((p) => el('div', {class: `msg${p.reply ? ' reply' : ''}`}, el('span', {class: 'who', text: p.reply ? 'You · thread reply · 9:12 a.m.' : 'You · 9:07 a.m.'}), el('p', {text: p.text})))) : null),
      el('p', {class: `final-state ph-${r.phase}`, text: r.phase === 'completed' ? 'Completed: every step ran and the whole brief was posted.' : r.phase === 'partial' ? 'Partially completed: the dashboard step failed. This run is not marked successful.' : 'Ready for review. Nothing is posted until you choose to.'}));
  }

  function pmInvoke() {
    const typed = el('input', {type: 'text', placeholder: pm.skill ? `${pm.skill.command} focus on onboarding` : '/morning focus on onboarding', 'aria-label': 'Type a command'});
    typed.addEventListener('keydown', (e) => { if (e.key === 'Enter' && typed.value.trim()) dictate({id: typed.value.trim().startsWith('/') ? 'onboarding' : 'typed', text: typed.value.trim()}); pmRender(); });
    const r = pm.run;
    const pre = r ? [[true, `Skill recognized: ${pm.parsed.command}`], [true, `Inputs ready: focus ${r.inputs.focus || 'none'}, ${windowDetail(r.inputs.window || 'since-last')}`]] : [];
    return el('div', {class: 'stage'},
      el('div', {class: 'stage-head'}, el('h3', {text: 'Run it by voice'}), el('span', {class: 'tag tag-sim', text: 'Simulated dictation'})),
      el('div', {class: 'say-grid'}, ...utterances().map((u) => el('button', {type: 'button', class: 'say', onclick: () => { dictate(u); pmRender(); }}, el('span', {class: 'say-label', text: u.label}), el('span', {class: 'say-text', text: `“${u.text}”`})))),
      el('div', {class: 'typed'}, typed, el('button', {type: 'button', class: 'button small', onclick: () => { if (typed.value.trim()) { dictate({id: 'typed', text: typed.value.trim()}); pmRender(); } }, text: 'Run typed command'})),
      el('div', {class: 'cmd-box'}, el('span', {class: 'eyebrow', text: 'Dictation'}), commandLine()),
      el('div', {class: 'pe-panel', id: 'cmd-panel', hidden: !cmdEd.isEditing()}, el('div', {class: 'pe-panel-head'}, el('span', {text: 'Phrase Repair'}), el('span', {class: 'muted', text: 'Repeat only the word, not the command'})), cmdWords, cmdControls),
      interpretation(),
      impactNote(),
      r ? runView(r, pre) : null,
      r && r.phase === 'running' ? el('div', {class: 'button-row'}, el('button', {type: 'button', class: 'button small', onclick: () => { pm.run = K.reduceRun(pm.run, {type: 'CANCEL'}); clearInterval(pm.timer); pmRender(); }, text: 'Cancel run'})) : null,
      r && r.phase === 'cancelled' ? el('p', {class: 'final-state ph-cancelled', text: 'Cancelled. Nothing was posted.'}) : null,
      r ? resultView() : null);
  }

  function pmCreate() {
    const box = el('div', {class: 'stage editor'});
    renderEditor(box, Object.assign(pm.editor, {draft: pm.draft, mode: 'create', title: `Create ${pm.draft.command}`, subtitle: 'A new skill starts empty. Add its steps, sources and output.',
      onSaved: (skill) => { pm.stage = 'invoke'; cmdEd.reset(); pm.parsed = null; pmRender(); },
      onCancel: () => { pm.stage = 'invoke'; pmRender(); }}));
    return box;
  }

  function pmRender() {
    const view = {history: pmHistory, editor: pmEditor, saved: pmSaved, invoke: pmInvoke, create: pmCreate}[pm.stage]();
    $('pm-main').replaceChildren(view);
    pmStepper();
  }

  /* ================= Developer demo: /prs ================= */
  const dev = {};
  function devReset() { clearInterval(dev.timer); Object.assign(dev, {text: '', parsed: null, interp: null, run: null, timer: null}); }
  const DEV_UTTER = [
    {label: 'Run it', text: 'Slash prs for the payments repository. Prioritize anything blocking the release.'},
    {label: 'Missing detail', text: 'Slash prs.'},
  ];
  function devDictate(text) {
    clearInterval(dev.timer);
    dev.text = text; dev.run = null;
    dev.parsed = K.parseInvocation(text, registry);
    dev.interp = dev.parsed.kind === 'skill' ? K.interpret(dev.parsed.skill, dev.parsed.rest) : null;
    devRender();
  }
  function devRun() {
    const sk = dev.parsed.skill;
    dev.run = K.createRun(sk, dev.interp.inputs, {unavailable: Object.keys(conn).filter((t) => !conn[t])});
    clearInterval(dev.timer);
    if (reduceMotion()) { while (dev.run.phase === 'running') dev.run = K.reduceRun(dev.run, {type: 'TICK'}); devRender(); return; }
    dev.timer = setInterval(() => { dev.run = K.reduceRun(dev.run, {type: 'TICK'}); if (dev.run.phase !== 'running') clearInterval(dev.timer); devRender(); }, TICK_MS);
    devRender();
  }
  function devRender() {
    const sk = registry.find((s) => s.id === 'prs');
    const parts = [
      el('div', {class: 'skill-card'}, el('span', {class: 'skill-chip', text: sk.command}), el('span', {text: ` ${sk.name} · saved`}),
        el('p', {class: 'muted small'}, 'Sources: ', ...sk.sources.flatMap((s, i) => [i ? ' · ' : '', toolChip(s.tool, s.detail)])),
        el('p', {class: 'muted small', text: sk.excludes})),
      el('div', {class: 'say-grid two'}, ...DEV_UTTER.map((u) => el('button', {type: 'button', class: 'say', onclick: () => devDictate(u.text)}, el('span', {class: 'say-label', text: u.label}), el('span', {class: 'say-text', text: `“${u.text}”`})))),
    ];
    if (dev.parsed) {
      const p = dev.parsed;
      parts.push(el('div', {class: 'cmd-box'}, el('span', {class: 'eyebrow', text: 'Dictation'}), el('p', {class: 'cmd-text'},
        p.kind === 'skill' ? el('span', {class: 'skill-chip', text: `${p.command} · ${p.skill.name}`}) : null, ' ', p.kind === 'skill' ? p.rest : dev.text)));
      if (p.kind === 'skill') {
        const inp = dev.interp.inputs;
        if (dev.interp.missing.includes('repo')) {
          parts.push(el('div', {class: 'interp warn'}, el('p', {}, el('strong', {text: 'Missing detail requested: '}), 'Which repository should this cover?'),
            el('div', {class: 'button-row'}, ...sk.inputs.repo.options.map((o) => el('button', {type: 'button', class: 'button small', onclick: () => { dev.interp = {inputs: {...inp, repo: o}, missing: []}; devRender(); }, text: o})))));
        } else {
          parts.push(el('div', {class: 'interp'}, el('dl', {},
            ...[['Repository', inp.repo], ['Scope', 'Pull requests awaiting your review'], ['Priority', inp.priority], ['Destination', sk.destination.value], ['Won’t do', 'Comment, approve or merge']].map(([k, v]) => el('div', {}, el('dt', {text: k}), el('dd', {text: v})))),
            dev.run ? null : el('div', {class: 'button-row'}, el('button', {type: 'button', class: 'button primary', onclick: devRun, text: 'Run /prs'}))));
        }
      }
    }
    if (dev.run) {
      parts.push(runView(dev.run, [[true, 'Skill recognized: /prs'], [true, `Inputs ready: ${dev.run.inputs.repo}, ${dev.run.inputs.priority}`]]));
      if (dev.run.phase === 'ready') {
        const q = K.buildQueue(dev.run);
        parts.push(el('div', {class: 'result'},
          el('div', {class: 'table-wrap'}, el('table', {class: 'queue'},
            el('thead', {}, el('tr', {}, ...['#', 'Pull request', 'CI', 'Release', 'Why this position'].map((h) => el('th', {text: h})))),
            el('tbody', {}, ...q.map((pr) => el('tr', {},
              el('td', {text: String(pr.position)}),
              el('td', {}, el('a', {href: `#pr-${pr.n}`, title: 'Sample link: in-page only', text: `#${pr.n}`}), ` ${pr.title}`, el('br'), el('span', {class: 'muted small', text: `${pr.author} · ${pr.size}`})),
              el('td', {}, el('span', {class: `ci ci-${pr.ci}`, text: pr.ci === 'failing' ? `failing: ${pr.failing}` : pr.ci})),
              el('td', {text: pr.blocker ? 'Blocking' : '—'}),
              el('td', {class: 'small', text: pr.why})))))),
          el('div', {class: 'slack-draft'}, el('div', {class: 'button-row'}, toolChip('slack', '#payments-dev · draft'), el('span', {class: 'tag tag-sim', text: 'Simulated destination'})),
            el('p', {class: 'draft-text', text: `Reviewing payments PRs this morning: #${q[0].n} first (release blocker, CI green), then #${q[1].n} once ${q[1].failing || 'its checks'} pass${q[1].failing ? 'es' : ''}. #${q[2].n} and #${q[3].n} after that.`}),
            el('p', {class: 'muted small', text: 'Kept as a draft, as this skill is configured. Posting, commenting, approving and merging are separate actions you take yourself.'}))));
      }
      if (dev.run.phase === 'partial') parts.push(el('p', {class: 'final-state ph-partial', text: 'Partially completed: a source wasn’t connected. Connect it in the panel and run again.'}));
    }
    $('dev-main').replaceChildren(...parts);
  }

  /* ================= Templates ================= */
  const TEMPLATES = [
    {id: 'feedback', name: 'Customer Feedback Review', command: '/feedback', example: 'Slash feedback for the last seven days.',
      sources: [{tool: 'gmail', detail: 'Label: choose one'}, {tool: 'slack', detail: 'Channels: choose'}],
      steps: [{id: 'gmail', text: 'Gather feedback from the selected Gmail labels', tool: 'gmail', uses: ['window']}, {id: 'slack', text: 'Gather feedback from the selected Slack channels', tool: 'slack', uses: ['window']}, {id: 'group', text: 'Group recurring problems', tool: null, uses: []}, {id: 'link', text: 'Link the supporting messages', tool: null, uses: []}, {id: 'draft', text: 'Draft a findings summary', tool: null, uses: []}],
      inputs: {window: {value: '7d', confirmed: true}}, output: 'Findings summary: recurring problems, each with linked messages.',
      questions: ['Which Gmail label contains the customer feedback?', 'Which Slack channels should this include?']},
    {id: 'dashboard', name: 'Dashboard Summary', command: '/dashboard', example: 'Slash dashboard for this week.',
      sources: [{tool: 'excel', detail: 'Workbook, sheet and table: choose'}],
      steps: [{id: 'excel', text: 'Read the selected tables', tool: 'excel', uses: ['window']}, {id: 'compare', text: 'Compare the period with the one before', tool: null, uses: ['window']}, {id: 'flag', text: 'Flag material changes', tool: null, uses: []}, {id: 'draft', text: 'Draft a concise explanation, keeping observed changes apart from possible explanations', tool: null, uses: []}],
      inputs: {window: {value: '7d', confirmed: true}}, output: 'Short summary: what changed, by how much, and what’s only a possible explanation.',
      questions: ['Which Excel workbook, sheet and table contain the dashboard?', 'Which metrics and thresholds should the summary highlight?']},
    {id: 'inbox', name: 'Inbox Brief', command: '/inbox', example: 'Slash inbox since yesterday.',
      sources: [{tool: 'gmail', detail: 'Unread from customers and stakeholders'}],
      steps: [{id: 'gmail', text: 'Summarize unread customer and stakeholder messages', tool: 'gmail', uses: ['window']}, {id: 'asks', text: 'Identify requests and deadlines', tool: null, uses: []}, {id: 'reply', text: 'Prepare reply drafts where requested', tool: null, uses: []}],
      inputs: {window: {value: '24h', confirmed: true}}, output: 'Requests and deadlines, with reply drafts you can edit.',
      questions: ['Should the result stay private, become a draft, or be sent after approval?']},
    {id: 'release', name: 'Release Readiness', command: '/release', example: 'Slash release for version two point four.',
      sources: [{tool: 'github', detail: 'Merged changes and failed checks'}, {tool: 'slack', detail: 'Blocker reports'}, {tool: 'excel', detail: 'Release checklist workbook: choose'}],
      steps: [{id: 'github', text: 'Compare merged changes and failed checks for the version', tool: 'github', uses: ['version']}, {id: 'slack', text: 'Collect reported blockers', tool: 'slack', uses: ['version']}, {id: 'excel', text: 'Read checklist status', tool: 'excel', uses: ['version']}, {id: 'brief', text: 'Prepare a release-readiness brief', tool: null, uses: ['version']}],
      inputs: {version: {value: '', required: true, note: 'Say it after the command: “for version two point four.”'}}, output: 'Release-readiness brief: ready, at risk or blocked, with the evidence.',
      questions: ['Which repositories should this include?', 'Which checklist workbook tracks the release?']},
  ];
  let tplOpen = null;
  function tplRender() {
    $('templates').replaceChildren(...TEMPLATES.map((t) => {
      const missing = [...new Set(t.sources.map((s) => s.tool))].filter((x) => !conn[x]);
      return el('article', {class: 'block tpl'},
        el('div', {class: 'button-row'}, el('span', {class: 'tag tag-proposed', text: 'Template'}), el('span', {class: 'skill-chip', text: t.command})),
        el('h3', {text: t.name}),
        el('p', {class: 'muted small'}, el('strong', {text: 'Needs: '}), ...t.sources.flatMap((s, i) => [i ? ' · ' : '', toolChip(s.tool, s.detail)])),
        el('ol', {class: 'small tpl-steps'}, ...t.steps.map((s) => el('li', {text: s.text}))),
        el('p', {class: 'small'}, el('strong', {text: 'Output: '}), t.output),
        el('p', {class: 'small'}, el('strong', {text: 'Say: '}), `“${t.example}”`),
        el('p', {class: 'muted small'}, el('strong', {text: 'Setup asks: '}), t.questions.join(' ')),
        el('div', {class: 'button-row'},
          ...missing.map((x) => el('button', {type: 'button', class: 'button small', onclick: () => { conn[x] = true; renderAll(); }, text: `Connect ${D.TOOL_NAMES[x]} (simulated)`})),
          el('button', {type: 'button', class: 'button small primary', disabled: missing.length > 0, title: missing.length ? 'Connect the missing source first' : null,
            onclick: () => { tplOpen = {key: `tpl-${t.id}`, draft: {id: null, name: t.name, command: t.command, basedOn: [], sources: clone(t.sources), steps: clone(t.steps), inputs: clone(t.inputs), metrics: null, output: t.output, destination: {value: 'Private'}, completion: {value: 'draft'}, questions: t.questions, answers: {}}}; tplEditor(); $('tpl-editor').scrollIntoView({behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start'}); }, text: 'Edit template'})));
    }));
  }
  function tplEditor() {
    const box = $('tpl-editor');
    box.hidden = !tplOpen;
    if (!tplOpen) return;
    renderEditor(box, Object.assign(tplOpen, {mode: 'template', title: `Edit ${tplOpen.draft.name}`, subtitle: 'Templates start generic. Choose your sources, then save under a command.',
      onSaved: (skill) => { tplOpen = null; box.hidden = true; $('tpl-saved').textContent = `${skill.name} is ready. Say “${K.spokenForm(skill.command)}” to run it.`; },
      onCancel: () => { tplOpen = null; box.hidden = true; }}));
  }

  /* ================= Connections and registry ================= */
  function connRender() {
    $('connections').replaceChildren(...Object.keys(conn).map((t) => {
      const i = el('input', {type: 'checkbox', checked: conn[t]});
      i.addEventListener('change', () => { conn[t] = i.checked; renderAll(); });
      return el('label', {class: 'inline-check'}, i, ` ${D.TOOL_NAMES[t]}`);
    }));
    $('registry').replaceChildren(...registry.map((s) => el('li', {}, el('span', {class: 'skill-chip', text: s.command}), ` ${s.name}`)));
  }

  function renderAll() {
    connRender(); tplRender(); if (tplOpen) tplEditor(); pmRender(); devRender();
  }

  document.addEventListener('DOMContentLoaded', () => {
    pmReset(); devReset();
    cmdWords = el('div', {class: 'pe-words', role: 'group', 'aria-label': 'Words in the dictation'});
    cmdControls = el('div', {class: 'pe-controls'});
    cmdEd = window.PhraseEditor.create({words: cmdWords, controls: cmdControls, compact: true,
      onChange: (action) => {
        if (action.type === 'APPLY' || action.type === 'DISMISS') onCommandRepaired();
        else if (action.type !== 'SET_REPLACEMENT') pmRender();
      }});
    $('pm-reset').addEventListener('click', () => { pmReset(); pmRender(); });
    $('dev-reset').addEventListener('click', () => { devReset(); devRender(); });
    renderAll();
  });
})();

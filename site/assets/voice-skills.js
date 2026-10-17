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
  const TICK_MS = 600;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const pct = (n) => `${n.toFixed(1)}%`;
  const pts = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)} pts`;

  /* Shared, simulated state: connections and the skill registry */
  const conn = {...D.CONNECTIONS};
  let registry = clone(K.SAVED);
  /* Product marks so each tool reads at a glance. Static strings, drawn after the public logos. */
  const LOGOS = {
    gmail: '<svg viewBox="52 42 88 66" aria-hidden="true"><path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6"/><path fill="#34a853" d="M120 108h14c3.32 0 6-2.690 6-6V59l-20 15"/><path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2"/><path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92"/><path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2"/></svg>',
    slack: '<svg viewBox="0 0 127 127" aria-hidden="true"><path fill="#e01e5a" d="M27.2 80c0 7.3-5.9 13.2-13.2 13.2C6.7 93.2.8 87.3.8 80c0-7.3 5.9-13.2 13.2-13.2h13.2V80zm6.6 0c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2v33c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V80z"/><path fill="#36c5f0" d="M47 27c-7.3 0-13.2-5.9-13.2-13.2C33.8 6.5 39.7.6 47 .6c7.3 0 13.2 5.9 13.2 13.2V27H47zm0 6.7c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H13.9C6.6 60.1.7 54.2.7 46.9c0-7.3 5.9-13.2 13.2-13.2H47z"/><path fill="#2eb67d" d="M99.9 46.9c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H99.9V46.9zm-6.6 0c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V13.8C66.9 6.5 72.8.6 80.1.6c7.3 0 13.2 5.9 13.2 13.2v33.1z"/><path fill="#ecb22e" d="M80.1 99.8c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V99.8h13.2zm0-6.6c-7.3 0-13.2-5.9-13.2-13.2 0-7.3 5.9-13.2 13.2-13.2h33.1c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H80.1z"/></svg>',
    excel: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2" width="15" height="20" rx="2" fill="#21a366"/><path fill="#107c41" d="M7 12h15v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"/><path fill="#33c481" d="M9 2h11a2 2 0 0 1 2 2v3H7V4a2 2 0 0 1 2-2z"/><path fill="#185c37" d="M7 7h7.5v10H7z" opacity=".35"/><rect x="2" y="6" width="12" height="12" rx="1.6" fill="#107c41"/><path fill="#fff" d="M4.6 8.8h2.1l1.3 2.4 1.4-2.4h2l-2.3 3.4 2.3 3.6h-2.1L8 13.3l-1.4 2.5H4.5l2.4-3.6z"/></svg>',
    github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.840 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .32.21.7.82.58A12 12 0 0 0 12 .3"/></svg>',
  };
  const logo = (tool) => { const s = el('span', {class: 'tool-logo'}); s.innerHTML = LOGOS[tool] || ''; return s; };
  const toolChip = (tool, detail) => el('span', {class: `tool tool-${tool}${conn[tool] ? '' : ' off'}`},
    logo(tool), el('b', {text: D.TOOL_NAMES[tool]}), detail ? ` ${detail}` : '', conn[tool] ? null : el('em', {text: ' · not connected'}));
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
  /* Kept short on purpose: one color per tool, one decision per screen. The same colors mark the repeated parts
     of each past request and the routine Flow suggests saving. */
  const pm = {};
  let cmdEd;
  let cmdWords;
  let cmdControls;
  function pmReset() {
    clearInterval(pm.timer);
    Object.assign(pm, {history: D.HISTORY.map((x) => (x.id === 'r3' ? {...x, status: 'completed', accepted: true} : x)), prefs: {}, stage: 'history', draft: null, skill: null, parsed: null, interp: null, plain: null,
      run: null, timer: null, draftText: '', replyText: '', flags: new Set(), impact: null, postNote: null, posts: [], reviewError: null, justSaved: false});
    registry = registry.filter((s) => s.id !== 'morning' && !(s.basedOn && s.basedOn.length));
    if (cmdEd) cmdEd.reset();
    if (composer) composer.clear();
    pm.invokeShell = null;
  }

  const PM_STEPS = [
    ['suggested', 'Flow spots a routine'],
    ['saved', 'Save it as /morning'],
    ['dictated', 'Say “slash morning”'],
    ['brief', 'Watch it run'],
    ['posted', 'Approve and post'],
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

  /* The repeated parts, colored by where they come from. */
  const REPEATS = [
    {key: 'gmail', re: /customer feedback (?:label|email)/i},
    {key: 'slack', re: /#onboarding-feedback/},
    {key: 'excel', re: /(?:Onboarding )?KPIs funnel table/i},
    {key: 'out', re: /#product-onboarding/},
  ];
  function marked(text) {
    const all = new RegExp(REPEATS.map((r) => `(${r.re.source})`).join('|'), 'gi');
    const out = [];
    let at = 0;
    for (const m of text.matchAll(all)) {
      out.push(text.slice(at, m.index));
      const key = REPEATS[m.slice(1).findIndex(Boolean)].key;
      out.push(el('mark', {class: `rp rp-${key}`, text: m[0]}));
      at = m.index + m[0].length;
    }
    out.push(text.slice(at));
    return out;
  }
  const ROUTINE = [
    {key: 'gmail', tool: 'gmail', text: 'Customer feedback emails'},
    {key: 'slack', tool: 'slack', text: '#onboarding-feedback'},
    {key: 'excel', tool: 'excel', text: 'Onboarding KPIs funnel table'},
    {key: 'out', tool: 'slack', text: 'Draft an update for #product-onboarding'},
  ];
  const routineList = () => el('ol', {class: 'routine'}, ...ROUTINE.map((r) => el('li', {class: `rp-${r.key}`},
    el('span', {class: 'routine-dash', 'aria-hidden': 'true', text: r.key === 'out' ? '→' : '—'}), logo(r.tool), el('span', {text: r.text}))));

  function pmHistory() {
    const sig = 'morning-brief';
    const s = K.suggestionState(pm.history, sig, pm.prefs);
    pm.flags.add('suggested');
    const runs = K.qualifyingRuns(pm.history, sig);
    const sug = s.show ? el('div', {class: 'suggestion', role: 'status'},
      el('p', {class: 'sug-title', text: 'Same routine, three mornings in a row. Save it as a skill?'}),
      routineList(),
      el('div', {class: 'button-row'},
        el('button', {type: 'button', class: 'button primary', onclick: () => { pm.draft = {name: 'Morning Product Brief', command: '/morning', window: 'since-last'}; pm.stage = 'review'; pmRender(); }, text: 'Save as a skill'}),
        el('button', {type: 'button', class: 'button quiet', onclick: () => { pm.prefs.snoozedAt = s.n; pmRender(); }, text: 'Not now'})))
      : el('p', {class: 'muted small'}, 'Suggestion hidden. ', el('button', {type: 'button', class: 'link', onclick: () => { delete pm.prefs.snoozedAt; pmRender(); }, text: 'Show it again'}));
    return el('div', {class: 'stage'},
      el('div', {class: 'stage-head'}, el('h3', {text: 'Flow noticed a routine'}), el('span', {class: 'counter', text: `${runs.length} of ${K.SUGGEST_AFTER} mornings`})),
      el('ul', {class: 'history'}, ...runs.map((r) => el('li', {class: 'hist'},
        el('span', {class: 'when', text: r.when.split(',').slice(0, 2).join(',')}),
        el('span', {class: 'req'}, ...marked(r.request)),
        el('span', {class: 'tick', 'aria-label': 'Completed', text: '✓'})))),
      sug);
  }

  function pmReview() {
    const d = pm.draft;
    const nameIn = el('input', {type: 'text', 'aria-label': 'Skill name'});
    nameIn.value = d.name;
    nameIn.addEventListener('input', () => { d.name = nameIn.value; });
    const cmdIn = el('input', {type: 'text', 'aria-label': 'Voice command', class: 'mono-in'});
    cmdIn.value = d.command;
    const spoken = el('span', {class: 'hint'});
    const say = () => { spoken.textContent = K.validateCommand(d.command, []).ok ? `Say “${K.spokenForm(d.command)}”` : ''; };
    cmdIn.addEventListener('input', () => { d.command = cmdIn.value.trim().toLowerCase(); say(); });
    say();
    const save = () => {
      const v = K.validateCommand(d.command, registry);
      pm.reviewError = !d.name.trim() ? 'Give it a name.' : v.conflict ? `${d.command} is taken. Pick another.` : !v.ok ? 'Use a slash and a short word, like /morning.' : !d.window ? 'Pick what each run should cover.' : null;
      if (pm.reviewError) { pmRender(); return; }
      const base = K.inferDraft(pm.history);
      base.inputs.window.value = d.window; base.inputs.window.confirmed = true; base.metrics.threshold = 2; base.completion.inferred = false;
      const skill = clone({...base, id: d.command.slice(1), name: d.name.trim(), command: d.command});
      registry = registry.filter((x) => x.id !== skill.id).concat(skill);
      pm.skill = skill; pm.stage = 'invoke'; pm.justSaved = true; pm.flags.add('saved');
      renderAll();
    };
    return el('div', {class: 'stage review'},
      el('div', {class: 'stage-head'}, el('h3', {text: 'Save your skill'})),
      el('div', {class: 'editor-grid'},
        el('div', {class: 'field-wrap'}, el('label', {text: 'Name'}), nameIn),
        el('div', {class: 'field-wrap'}, el('label', {text: 'Voice command'}), cmdIn, spoken)),
      routineList(),
      el('div', {class: 'ask'},
        el('p', {class: 'ask-q'}, 'Each run covers', el('span', {class: 'guess', text: 'Flow’s guess from your runs'})),
        el('div', {class: 'pills', role: 'radiogroup', 'aria-label': 'What each run covers'}, ...[['since-last', 'Since my last brief'], ['24h', 'Last 24 hours']].map(([k, l]) => {
          const i = el('input', {type: 'radio', name: 'pm-window', value: k, checked: d.window === k});
          i.addEventListener('change', () => { d.window = k; pm.reviewError = null; });
          return el('label', {class: 'pill'}, i, el('span', {text: l}));
        }))),
      el('p', {class: 'muted small', text: 'Drafts to Slack. Nothing posts until you approve.'}),
      pm.reviewError ? el('p', {class: 'form-error', role: 'alert', text: pm.reviewError}) : null,
      el('div', {class: 'button-row'},
        el('button', {type: 'button', class: 'button primary', onclick: save, text: 'Save skill'}),
        el('button', {type: 'button', class: 'button quiet', onclick: () => { pm.stage = 'history'; pmRender(); }, text: 'Back'})));
  }

  /* Invocation */
  function utterances() {
    const say = pm.skill ? cap(K.spokenForm(pm.skill.command)) : 'Slash morning';
    return [
      {id: 'onboarding', label: 'Run with a focus', text: `${say}, focus on onboarding.`},
      {id: 'activation', label: 'A misheard word', text: `${say}, focus on activation.`, highlights: [{phrase: 'activation', alternatives: ['retention', 'activity'], repeat: 'retention'}]},
      {id: 'unknown', label: 'An unknown skill', text: 'Slash standup, keep it short.'},
      {id: 'ordinary', label: 'Plain dictation', text: 'I’ll send the morning brief after lunch.'},
    ];
  }

  function dictate(u) {
    clearInterval(pm.timer);
    pm.run = null; pm.impact = null; pm.plain = null; pm.postNote = null; pm.justSaved = false;
    cmdEd.reset();
    cmdEd.dispatch({type: 'LOAD', text: u.text, highlights: u.highlights || []});
    pm.lastCase = u.id;
    parse();
    if (pm.parsed.kind === 'skill' && pm.skill && pm.parsed.skill.id === pm.skill.id) pm.flags.add('dictated');
    if (composer) composer.sync();
  }

  function parse() {
    pm.parsed = K.parseInvocation(cmdEd.state.text, registry);
    pm.interp = pm.parsed.kind === 'skill' ? K.interpret(pm.parsed.skill, pm.parsed.rest) : null;
  }

  function commandLine() {
    const s = cmdEd.state;
    if (!s.text) return null;
    const p = pm.parsed;
    const nodes = [];
    let from = 0;
    if (p && (p.kind === 'skill' || p.kind === 'unknown')) {
      nodes.push(el('span', {class: `skill-chip${p.kind === 'unknown' ? ' unknown' : ''}`, title: p.kind === 'skill' ? 'Recognized skill' : 'Not a saved skill'}, p.command), ' ');
      from = s.text.indexOf(p.trigger) + p.trigger.length;
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
    if (pm.plain) return el('p', {class: 'interp neutral'}, 'Inserted as text. Nothing ran.');
    if (p.kind === 'text') return el('p', {class: 'interp neutral'}, 'No command at the start, so it’s just text. Nothing runs.');
    if (p.kind === 'unknown') {
      return el('div', {class: 'interp warn'},
        el('p', {}, el('strong', {text: `No skill called ${p.command}.`}), ' Flow won’t guess.'),
        el('div', {class: 'button-row'},
          el('button', {type: 'button', class: 'button small', onclick: () => createFromCommand(p.command), text: `Create ${p.command}`}),
          el('button', {type: 'button', class: 'button small', onclick: () => { pm.plain = cmdEd.state.text; pmRender(); }, text: 'Keep as text'})));
    }
    const sk = p.skill;
    const inp = pm.interp.inputs;
    const focusMarked = FS.openHighlights(cmdEd.state).some((h) => cmdEd.state.text.slice(h.start, h.end).toLowerCase() === inp.focus);
    const facts = [
      ['Focus', inp.focus || 'everything'],
      ['Covers', sk.inputs.window && sk.inputs.window.value === 'since-last' ? 'since your last brief' : windowLabel(sk.inputs.window ? sk.inputs.window.value : '24h').toLowerCase()],
      ['Posts', 'after you approve'],
    ];
    return el('div', {class: 'interp'},
      el('p', {class: 'facts'}, ...facts.flatMap(([k, v], i) => [i ? el('span', {class: 'sep', text: '·'}) : null, el('span', {}, el('b', {text: `${k} `}), v)])),
      focusMarked && !pm.run ? el('p', {class: 'small warn-text', text: `“${inp.focus}” might be misheard. Tap it to fix just that word.`}) : null,
      pm.run ? null : el('div', {class: 'button-row'},
        el('button', {type: 'button', class: 'button primary', onclick: startRun, text: `Run ${sk.command}`}),
        el('button', {type: 'button', class: 'button quiet', onclick: () => { cmdEd.reset(); pm.parsed = null; composer.clear(); pmRender(); }, text: 'Clear'})));
  }

  function createFromCommand(command) {
    pm.draftNew = {id: null, name: '', command, basedOn: [], sources: [], steps: [], inputs: {}, metrics: null, output: '', destination: {value: 'Private'}, completion: {value: 'draft'}};
    pm.editor = {key: 'pm-new'};
    pm.stage = 'create';
    pmRender();
  }

  function startRun() {
    const sk = pm.parsed.skill;
    const inputs = {...pm.interp.inputs, window: sk.inputs.window ? sk.inputs.window.value : undefined, threshold: (sk.metrics && sk.metrics.threshold) || 2};
    pm.run = K.createRun(sk, inputs, {unavailable: Object.keys(conn).filter((t) => !conn[t]), sections: ['feedback', 'metrics']});
    pm.draftText = ''; pm.replyText = ''; pm.postNote = null; pm.impact = null; pm.posts = [];
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
    composer.sync();
    const after = pm.interp && pm.interp.inputs.focus;
    if (pm.run && after !== undefined && after !== before && !['cancelled'].includes(pm.run.phase)) {
      pm.run = K.reduceRun(pm.run, {type: 'CHANGE_INPUT', key: 'focus', value: after});
      pm.impact = {from: before, to: after};
      pm.draftText = ''; pm.replyText = '';
      if (pm.run.phase === 'running') tickLoop();
    }
    pmRender();
  }

  function impactNote() {
    const im = pm.impact;
    if (!im) return null;
    return el('div', {class: 'impact', role: 'status'},
      el('p', {}, el('strong', {text: `Focus changed to “${im.to}”.`}), ' Only the steps that used it run again.'),
      pm.run.phase === 'stale' ? el('div', {class: 'button-row'}, el('button', {type: 'button', class: 'button small primary', onclick: () => { pm.run = K.reduceRun(pm.run, {type: 'RERUN_STALE'}); tickLoop(); pmRender(); }, text: 'Run them again'})) : null);
  }

  const shortQ = (q) => (q ? q.split('?')[0] + '?' : '');
  function briefText(b) {
    const lines = [`Morning brief, ${D.TODAY.replace(/, 2026$/, '')}${b.focus ? ` · ${b.focus}` : ''}`];
    if (b.theme) lines.push(`• ${b.theme.title} (${b.theme.emails} emails, ${b.theme.slack} Slack messages)`);
    if (b.metric) {
      const flagged = b.metric.filter((m) => m.flagged);
      lines.push(flagged.length ? flagged.map((m) => `• ${m.name} ${m.delta > 0 ? 'up' : 'down'} ${Math.abs(m.delta).toFixed(1)} pts (${pct(m.prev)} → ${pct(m.now)}). Cause not known yet.`).join('\n') : '• Metrics: no big changes.');
    } else lines.push('• Dashboard: couldn’t open the workbook. Follow-up to come.');
    if (b.question) lines.push(`• Open question: ${shortQ(b.question)}`);
    return lines.join('\n');
  }
  function metricsReplyText(b) {
    const flagged = b.metric.filter((m) => m.flagged);
    return `Dashboard follow-up: ${flagged.length ? flagged.map((m) => `${m.name} ${m.delta > 0 ? 'up' : 'down'} ${Math.abs(m.delta).toFixed(1)} pts (${pct(m.prev)} → ${pct(m.now)}).`).join(' ') : 'no big changes.'}`;
  }

  /* The result is the Slack draft itself, with its sources one tap away. */
  function resultView() {
    const r = pm.run;
    if (!['ready', 'partial', 'completed'].includes(r.phase)) return null;
    const b = K.buildBrief(r);
    if (!pm.draftText) pm.draftText = briefText(b);
    const posted = (sec) => r.posted.includes(sec);
    const channel = '#product-onboarding';
    const srcs = [...D.PM_SOURCES.gmail, ...D.PM_SOURCES.slack].filter((m) => m.focus === b.focus && (!b.theme || b.theme.sources.includes(m.id)));
    const ta = el('textarea', {rows: 5, 'aria-label': 'Slack draft', spellcheck: 'true'});
    ta.value = pm.draftText;
    ta.addEventListener('input', () => { pm.draftText = ta.value; });
    let action = null;
    if (!posted('feedback')) {
      action = el('button', {type: 'button', class: 'button primary', onclick: () => { const secs = r.phase === 'partial' ? ['feedback'] : ['feedback', 'metrics']; pm.run = K.reduceRun(pm.run, {type: 'POST', sections: secs}); pm.posts = [...pm.posts, {text: pm.draftText, reply: false}]; pm.flags.add('posted'); pmRender(); },
        text: r.phase === 'partial' ? 'Post what’s ready' : 'Approve and post'});
    } else if (r.phase === 'ready' && !posted('metrics')) {
      if (!pm.replyText) pm.replyText = metricsReplyText(b);
      action = el('button', {type: 'button', class: 'button primary', onclick: () => { pm.run = K.reduceRun(pm.run, {type: 'POST', sections: ['feedback', 'metrics']}); pm.posts = [...pm.posts, {text: pm.replyText, reply: true}]; pmRender(); }, text: 'Post the dashboard as a reply'});
    }
    const failed = !b.metric ? el('div', {class: 'failure'},
      el('p', {}, el('strong', {text: 'Excel step failed.'}), ' The rest is ready.'),
      el('button', {type: 'button', class: 'button small', onclick: () => { pm.run = K.reduceRun(pm.run, {type: 'RETRY', fixed: true}); conn.excel = true; connRender(); if (!pm.run.posted.length) pm.draftText = ''; tickLoop(); pmRender(); }, text: 'Retry just that step'})) : null;
    return el('div', {class: 'result'},
      failed,
      el('div', {class: 'slack-draft'},
        el('div', {class: 'draft-head'}, toolChip('slack', `${channel} · ${posted('feedback') ? 'posted' : 'draft'}`)),
        posted('feedback') ? null : ta,
        srcs.length ? el('details', {class: 'sources'}, el('summary', {text: `${srcs.length} sources`}),
          el('ul', {class: 'plain small'}, ...srcs.map((m) => el('li', {}, logo(m.from ? 'gmail' : 'slack'), el('span', {class: 'muted', text: m.snippet || m.text}))))) : null,
        action ? el('div', {class: 'button-row'}, action) : null,
        pm.posts.length ? el('div', {class: 'channel'},
          ...pm.posts.map((p) => el('div', {class: `msg${p.reply ? ' reply' : ''}`}, el('span', {class: 'who', text: p.reply ? 'You · reply · 9:12 a.m.' : 'You · 9:07 a.m.'}), el('p', {text: p.text})))) : null),
      r.phase === 'completed' ? el('p', {class: 'final-state ph-completed', text: '✓ Done. Posted once, after your approval.'}) : null,
      r.phase === 'partial' ? el('p', {class: 'final-state ph-partial', text: 'Partly done. Not marked as a success.'}) : null);
  }

  /* Run it by voice. The composer is built once and stays mounted while the run below it re-renders, so typing
     is never interrupted. The mic “speaks” a prepared line into it; anything typed is read the same way. */
  let composer;
  function buildComposer() {
    const input = el('input', {type: 'text', class: 'composer-input', 'aria-label': 'Dictation or typed command', autocomplete: 'off', spellcheck: 'false'});
    const mic = el('button', {type: 'button', class: 'mic attn', 'aria-label': 'Speak the command (simulated)'});
    mic.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg><span class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
    mic.append(el('span', {class: 'mic-label', text: 'Speak'}));
    const enter = el('button', {type: 'button', class: 'button primary small', 'aria-label': 'Send to Flow'}, el('span', {class: 'enter-label', text: 'Send'}), ' ↵');
    const box = el('div', {class: 'composer'}, mic, input, enter);
    const hint = el('p', {class: 'composer-hint', 'aria-live': 'polite'});
    let speaking = null;

    function showHint() {
      const v = input.value.trim();
      if (speaking) { hint.replaceChildren('Listening…'); return; }
      if (pm.parsed && v && v === cmdEd.state.text.trim()) { hint.replaceChildren(); return; }
      if (!v) { hint.replaceChildren('Tap the mic, or type a command.'); return; }
      const p = K.parseInvocation(v, registry);
      if (p.kind === 'skill') hint.replaceChildren(el('span', {class: 'skill-chip', text: p.command}), 'Press Enter to run.');
      else if (p.kind === 'unknown') hint.replaceChildren(el('span', {class: 'skill-chip unknown', text: p.command}), 'Not a saved skill.');
      else hint.replaceChildren('No command at the start, so this is just text.');
    }
    function send() {
      const v = input.value.trim();
      if (!v || speaking) return;
      dictate(utterances().find((x) => x.text === v) || {id: 'typed', text: v});
      pmRender();
    }
    function speak(u) {
      clearInterval(speaking);
      mic.classList.remove('attn');
      const words = u.text.split(' ');
      let n = 0;
      input.value = '';
      box.classList.add('listening');
      const finish = () => { clearInterval(speaking); speaking = null; box.classList.remove('listening'); input.value = u.text; dictate(u); showHint(); pmRender(); };
      if (reduceMotion()) { finish(); return; }
      speaking = setInterval(() => { n += 1; input.value = words.slice(0, n).join(' '); if (n >= words.length) finish(); }, 120);
      showHint();
    }
    mic.addEventListener('click', () => speak(utterances()[0]));
    enter.addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
    input.addEventListener('input', showHint);
    composer = {
      box, hint, speak,
      clear() { clearInterval(speaking); speaking = null; box.classList.remove('listening'); input.value = ''; mic.classList.add('attn'); showHint(); },
      sync() { if (!speaking) { input.value = cmdEd.state.text; showHint(); } },
      refresh() { input.placeholder = pm.skill ? `${pm.skill.command} focus on retention` : '/morning focus on onboarding'; showHint(); },
    };
  }

  function pmInvoke() {
    composer.refresh();
    const others = utterances().slice(1);
    pm.invokeDyn = el('div', {class: 'stage'});
    pm.invokeShell = el('div', {class: 'stage'},
      el('div', {class: 'stage-head'}, el('h3', {text: 'Now say it'}), pm.skill ? el('span', {class: 'saved-pill'}, '✓ ', el('span', {class: 'skill-chip', text: pm.skill.command}), ' saved') : null),
      composer.box, composer.hint,
      el('div', {class: 'cases'}, el('span', {class: 'lead', text: 'Also try:'}),
        ...others.map((u) => el('button', {type: 'button', class: 'case', 'data-case': u.id, title: `Says: ${u.text}`, onclick: () => composer.speak(u), text: u.label}))),
      pm.invokeDyn);
    return pm.invokeShell;
  }

  const RUN_LABELS = {gmail: 'Customer feedback emails', slack: '#onboarding-feedback', excel: 'Onboarding KPIs', compare: 'Separate facts from guesses', draft: 'Draft the update'};
  function pmRunView(run) {
    return el('ol', {class: 'run-steps', 'aria-label': K.statusLine(run, D.TOOL_NAMES)}, ...run.steps.map((s) => el('li', {class: `${s.status} rp-${s.tool || 'out'}`},
      el('span', {class: 'st', 'aria-hidden': 'true', text: stepState(s.status)[0]}),
      el('span', {class: 'lbl'}, s.tool ? logo(s.tool) : el('span', {class: 'tool-logo flow-dot', 'aria-hidden': 'true'}), RUN_LABELS[s.id] || s.text),
      el('span', {class: 'det', text: stepDetail(run, s)}))));
  }

  function invokeDynamic() {
    const r = pm.run;
    pm.invokeShell.querySelectorAll('.case').forEach((b) => b.setAttribute('aria-pressed', String(!!pm.parsed && b.dataset.case === pm.lastCase)));
    const line = pm.parsed ? commandLine() : null;
    return [
      line ? el('div', {class: 'cmd-box'}, line) : null,
      el('div', {class: 'pe-panel', id: 'cmd-panel', hidden: !cmdEd.isEditing()}, el('div', {class: 'pe-panel-head'}, el('span', {text: 'Edit a phrase'}), el('span', {class: 'muted', text: 'Repeat just the word'})), cmdWords, cmdControls),
      interpretation(),
      impactNote(),
      r ? pmRunView(r) : null,
      r && r.phase === 'running' ? el('div', {class: 'button-row'}, el('button', {type: 'button', class: 'button small quiet', onclick: () => { pm.run = K.reduceRun(pm.run, {type: 'CANCEL'}); clearInterval(pm.timer); pmRender(); }, text: 'Cancel'})) : null,
      r && r.phase === 'cancelled' ? el('p', {class: 'final-state', text: 'Cancelled. Nothing was posted.'}) : null,
      r ? resultView() : null].filter(Boolean);
  }

  function pmCreate() {
    const box = el('div', {class: 'stage editor'});
    renderEditor(box, Object.assign(pm.editor, {draft: pm.draftNew, mode: 'create', title: `Create ${pm.draftNew.command}`, subtitle: 'A new skill starts empty.',
      onSaved: () => { pm.stage = 'invoke'; cmdEd.reset(); pm.parsed = null; composer.clear(); pmRender(); },
      onCancel: () => { pm.stage = 'invoke'; pmRender(); }}));
    return box;
  }

  function pmRender() {
    if (pm.stage === 'invoke') {
      if (!pm.invokeShell || !$('pm-main').contains(pm.invokeShell)) $('pm-main').replaceChildren(pmInvoke());
      pm.invokeDyn.replaceChildren(...invokeDynamic());
    } else {
      $('pm-main').replaceChildren({history: pmHistory, review: pmReview, create: pmCreate}[pm.stage]());
    }
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
      return el('label', {class: 'inline-check'}, i, logo(t), D.TOOL_NAMES[t]);
    }));
  }

  function renderAll() {
    connRender(); tplRender(); if (tplOpen) tplEditor(); pmRender(); devRender();
  }

  document.addEventListener('DOMContentLoaded', () => {
    buildComposer();
    pmReset(); devReset();
    cmdWords = el('div', {class: 'pe-words', role: 'group', 'aria-label': 'Words in the dictation'});
    cmdControls = el('div', {class: 'pe-controls'});
    cmdEd = window.PhraseEditor.create({words: cmdWords, controls: cmdControls, compact: true,
      onChange: (action) => {
        if (action.type === 'APPLY' || action.type === 'DISMISS') onCommandRepaired();
        else if (action.type !== 'SET_REPLACEMENT') pmRender();
      }});
    $('pm-reset').addEventListener('click', () => { pmReset(); pmRender(); });
    $('pm-skip').addEventListener('click', () => {
      /* Same outcome as saving the suggestion by hand as /morning, covering everything since the last brief. */
      pmReset();
      pm.history = pm.history.map((x) => (x.id === 'r3' ? {...x, status: 'completed', accepted: true} : x));
      const d = K.inferDraft(pm.history);
      d.command = '/morning'; d.inputs.window.value = 'since-last'; d.inputs.window.confirmed = true; d.metrics.threshold = 2;
      const skill = clone({...d, id: 'morning'});
      registry = registry.filter((s) => s.id !== 'morning').concat(skill);
      pm.skill = skill; pm.stage = 'invoke';
      ['suggested', 'saved'].forEach((f) => pm.flags.add(f));
      renderAll();
      $('pm-demo').scrollIntoView({behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start'});
    });
    $('dev-reset').addEventListener('click', () => { devReset(); devRender(); });
    renderAll();
  });
})();

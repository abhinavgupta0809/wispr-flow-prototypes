/* Voice Skills: pure logic for invocation, discovery, drafting and execution. No DOM, so
   tests/skills.test.js can run it in Node. Nothing here connects to any tool: runs step through
   sample data, and "discovery" reads the simulated Flow task history in skills-data.js. */
(function (root) {
  const D = root.SkillsData || (typeof require !== 'undefined' ? require('./skills-data.js') : null);
  const clone = (x) => JSON.parse(JSON.stringify(x));

  /* Discovery: three qualifying runs. A qualifying run is completed, accepted, not a retry of another run,
     and follows the same process (same sources, steps and destination), whatever its dates. */
  const SUGGEST_AFTER = 3;
  const qualifyingRuns = (history, signature) => history.filter((r) => r.signature === signature && r.status === 'completed' && r.accepted && !r.retryOf);
  function whyNotCounted(r) {
    if (r.retryOf) return 'Retry of an earlier run, not counted';
    if (r.status === 'cancelled') return 'Cancelled, not counted';
    if (r.status !== 'completed' || !r.accepted) return 'Not accepted yet';
    return null;
  }
  function suggestionState(history, signature, prefs = {}) {
    const n = qualifyingRuns(history, signature).length;
    if (prefs.never) return {show: false, n, reason: 'never'};
    if (prefs.snoozedAt !== undefined && prefs.snoozedAt >= n) return {show: false, n, reason: 'snoozed'};
    return {show: n >= SUGGEST_AFTER, n, reason: n >= SUGGEST_AFTER ? 'ready' : 'too-few'};
  }

  /* Skills */
  const MORNING_STEPS = [
    {id: 'gmail', text: 'Read new customer feedback in Gmail (label “Customer feedback”)', tool: 'gmail', uses: ['window', 'focus']},
    {id: 'slack', text: 'Read new messages in Slack #onboarding-feedback', tool: 'slack', uses: ['window', 'focus']},
    {id: 'excel', text: 'Summarize the funnel table in Onboarding KPIs.xlsx', tool: 'excel', uses: ['focus']},
    {id: 'compare', text: 'Separate observed changes from possible explanations, and list open questions', tool: null, uses: ['focus']},
    {id: 'draft', text: 'Draft the Slack update for #product-onboarding', tool: null, uses: ['focus']},
  ];

  /* The draft Flow would infer from the three morning runs. `inferred` marks what the user should review. */
  function inferDraft(history) {
    const runs = qualifyingRuns(history, 'morning-brief');
    return {
      id: null,
      name: 'Morning Product Brief',
      command: '/product-brief',
      basedOn: runs.map((r) => r.id),
      sources: [
        {tool: 'gmail', detail: 'Label “Customer feedback”', inferred: true},
        {tool: 'slack', detail: '#onboarding-feedback (read only)', inferred: true},
        {tool: 'excel', detail: 'Onboarding KPIs.xlsx › Daily › tbl_funnel', inferred: true},
      ],
      steps: clone(MORNING_STEPS),
      inputs: {
        window: {value: '24h', inferred: true, confirmed: false, note: 'Your runs were about a day apart and each covered the time since the one before. The dates you typed become a rule; confirm which one.'},
        focus: {value: '', note: 'Changes each time. Say it after the command: “focus on onboarding.” Optional.'},
      },
      metrics: {value: '7-day onboarding completion, Day-7 activation', threshold: '', inferred: true},
      output: 'Three sections: customer themes, metric changes, open questions. Under 200 words, with a link to each source.',
      destination: {value: 'Slack draft in #product-onboarding', inferred: true},
      completion: {value: 'approval', inferred: true},
    };
  }

  const WINDOWS = [['since-last', 'Since the previous successful run'], ['24h', 'Last 24 hours'], ['7d', 'Last 7 days']];
  const COMPLETIONS = [['draft', 'Prepare a draft only'], ['approval', 'Prepare a draft and wait for my approval to post'], ['post', 'Post automatically (only if I turn this on)']];

  /* Only what can't be inferred reliably from the runs. */
  function setupQuestions(draft) {
    const qs = [];
    if (draft.inputs.window && !draft.inputs.window.confirmed) qs.push({key: 'window', question: 'Should this cover the last 24 hours or everything since your previous run?', prefill: draft.inputs.window.value, options: [['24h', 'Last 24 hours'], ['since-last', 'Everything since my previous run']]});
    if (draft.metrics && !draft.metrics.threshold) qs.push({key: 'threshold', question: 'Which metrics and thresholds should the summary highlight?', prefill: draft.metrics.value, options: ['1 point or more', '2 points or more', '5 points or more']});
    (draft.questions || []).forEach((q, i) => { if (!(draft.answers && draft.answers[`q${i}`])) qs.push({key: `q${i}`, question: q, freeText: true}); });
    return qs;
  }

  const COMMAND = /^\/[a-z][a-z0-9-]{1,23}$/;
  function validateCommand(command, skills, editingId = null) {
    if (!COMMAND.test(command)) return {ok: false, error: 'Use a slash, then 2 to 24 lowercase letters, numbers or hyphens.'};
    const clash = skills.find((s) => s.command === command && s.id !== editingId);
    if (clash) return {ok: false, conflict: clash};
    return {ok: true};
  }
  const spokenForm = (command) => `slash ${command.slice(1).replace(/-/g, ' ')}`;

  /* Saved skills to start with. /prs is the developer demo; /inbox exists so a name clash can be shown. */
  const SAVED = [
    {id: 'prs', name: 'Morning PR Review', command: '/prs', persona: 'developer',
      sources: [{tool: 'github', detail: 'Repositories: payments, web-app · review requests assigned to you'}, {tool: 'slack', detail: '#payments-release (read only) for blocker threads'}],
      steps: [
        {id: 'github', text: 'Find pull requests awaiting your review', tool: 'github', uses: ['repo']},
        {id: 'ci', text: 'Check CI status on each', tool: 'github', uses: ['repo']},
        {id: 'slack', text: 'Read #payments-release for blocker threads', tool: 'slack', uses: ['priority']},
        {id: 'order', text: 'Order the queue and explain why', tool: null, uses: ['priority', 'repo']},
        {id: 'draft', text: 'Draft a status update for #payments-dev', tool: null, uses: ['repo']},
      ],
      inputs: {repo: {value: '', required: true, options: ['payments', 'web-app']}, priority: {value: 'assigned order'}},
      output: 'A personal review queue with CI status, a short reason for the order, and links.',
      destination: {value: 'Private queue; status update kept as a Slack draft in #payments-dev'},
      completion: {value: 'draft'},
      excludes: 'It never comments, approves or merges. Those stay separate actions you take yourself.'},
    {id: 'inbox', name: 'Inbox Brief', command: '/inbox', persona: 'pm',
      sources: [{tool: 'gmail', detail: 'Unread from customers and stakeholders'}],
      steps: [{id: 'gmail', text: 'Summarize unread customer and stakeholder email', tool: 'gmail', uses: ['window']}, {id: 'draft', text: 'List requests and deadlines; draft replies where asked', tool: null, uses: []}],
      inputs: {window: {value: '24h'}}, output: 'Requests, deadlines and reply drafts.', destination: {value: 'Private'}, completion: {value: 'draft'}},
  ];

  /* Invocation. Only a command at the very start counts: spoken “slash name” or typed “/name”. */
  const SPOKEN = /^\s*slash\s+([a-z][a-z0-9]*(?:[ -][a-z0-9]+)?)\b\s*[,.:;]?\s*/i;
  const TYPED = /^\s*\/([a-z][a-z0-9-]*)\b\s*[,.:;]?\s*/i;

  function distance(a, b) {
    const dp = Array.from({length: a.length + 1}, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return dp[a.length][b.length];
  }

  function parseInvocation(text, skills) {
    const typed = text.match(TYPED);
    const spoken = !typed && text.match(SPOKEN);
    const m = typed || spoken;
    if (!m) return {kind: 'text', text};
    /* Spoken names may arrive as one or two words ("slash morning", "slash product brief"). Prefer the
       longest form that names a saved skill, else the first word. */
    const words = m[1].toLowerCase().split(/[ -]/);
    const candidates = words.length > 1 ? [words.join('-'), words[0]] : [words[0]];
    for (const name of candidates) {
      const skill = skills.find((s) => s.command === `/${name}`);
      if (skill) {
        const trigger = name === candidates[0] ? m[0] : text.match(new RegExp(`^\\s*(?:slash\\s+|/)${name}\\b\\s*[,.:;]?\\s*`, 'i'))[0];
        return {kind: 'skill', skill, command: `/${name}`, trigger: trigger.trim(), rest: text.slice(trigger.length).trim(), via: typed ? 'typed' : 'spoken'};
      }
    }
    const name = candidates[candidates.length - 1];
    const suggestions = skills.filter((s) => distance(s.command.slice(1), name) <= 2 || s.command.slice(1).startsWith(name.slice(0, 3)));
    return {kind: 'unknown', command: `/${name}`, trigger: m[0].trim(), rest: text.slice(m[0].length).trim(), suggestions, via: typed ? 'typed' : 'spoken'};
  }

  /* Changing inputs, read from what follows the command. */
  function interpret(skill, rest) {
    const inputs = {};
    const missing = [];
    if (skill.inputs.focus !== undefined) {
      const f = rest.match(/focus(?:ed)?\s+on\s+([a-z][a-z -]*?)\s*(?:[.,;]|$)/i);
      inputs.focus = f ? f[1].toLowerCase() : '';
    }
    if (skill.inputs.window !== undefined) {
      const w = rest.match(/last\s+(seven|7)\s+days|since\s+yesterday|last\s+24\s+hours/i);
      inputs.window = w ? (/seven|7/i.test(w[0]) ? '7d' : '24h') : skill.inputs.window.value;
    }
    if (skill.inputs.repo !== undefined) {
      const r = rest.match(/(?:for|in)\s+the\s+([a-z][\w-]*)\s+repo(?:sitory)?/i);
      inputs.repo = r ? r[1].toLowerCase() : '';
      if (!inputs.repo) missing.push('repo');
    }
    if (skill.inputs.priority !== undefined) {
      inputs.priority = /block(?:ing|s|er)?\b.*release|release\s+blockers?/i.test(rest) ? 'release blockers first' : skill.inputs.priority.value;
    }
    return {inputs, missing};
  }

  /* Execution. Steps go pending → running → done | failed. A tool marked unavailable fails its steps. */
  function createRun(skill, inputs, opts = {}) {
    return {
      skillId: skill.id, inputs: {...inputs}, phase: 'running',
      steps: skill.steps.map((s) => ({...s, status: 'pending', attempts: 0})),
      unavailable: [...(opts.unavailable || [])], sections: [...(opts.sections || [])], posted: [], lastPost: null, impact: [], events: ['start'],
    };
  }

  const settle = (run) => {
    if (run.steps.some((s) => s.status === 'pending' || s.status === 'running')) return run.phase === 'cancelled' ? run : {...run, phase: 'running'};
    if (run.steps.some((s) => s.status === 'stale')) return {...run, phase: 'stale'};
    const failed = run.steps.some((s) => s.status === 'failed');
    if (failed) return {...run, phase: 'partial'};
    const allPosted = run.sections.length > 0 && run.sections.every((x) => run.posted.includes(x));
    return {...run, phase: allPosted ? 'completed' : 'ready'};
  };

  function reduceRun(run, action) {
    switch (action.type) {
      case 'TICK': {
        if (run.phase !== 'running') return run;
        const steps = run.steps.map((s) => ({...s}));
        const running = steps.find((s) => s.status === 'running');
        if (running) {
          running.attempts += 1;
          running.status = running.tool && run.unavailable.includes(running.tool) ? 'failed' : 'done';
        } else {
          const next = steps.find((s) => s.status === 'pending');
          if (next) next.status = 'running';
        }
        return settle({...run, steps, events: [...run.events, 'tick']});
      }
      case 'CANCEL':
        if (run.phase !== 'running') return run;
        return {...run, phase: 'cancelled', steps: run.steps.map((s) => (s.status === 'pending' || s.status === 'running' ? {...s, status: 'cancelled'} : s)), events: [...run.events, 'cancel']};
      case 'RETRY': {
        /* Only failed steps run again, plus the steps that combine their output. Posts are untouched. */
        if (run.phase !== 'partial') return run;
        const unavailable = action.fixed ? run.unavailable.filter((t) => !run.steps.some((s) => s.status === 'failed' && s.tool === t)) : run.unavailable;
        const firstFailed = run.steps.findIndex((s) => s.status === 'failed');
        const steps = run.steps.map((s, i) => (s.status === 'failed' || (i > firstFailed && !s.tool && s.status === 'done') ? {...s, status: 'pending'} : s));
        return {...run, phase: 'running', unavailable, steps, events: [...run.events, 'retry']};
      }
      case 'CHANGE_INPUT': {
        const impact = [];
        const steps = run.steps.map((s) => {
          if (!s.uses.includes(action.key)) return s;
          if (s.status === 'done' || s.status === 'failed') { impact.push({step: s.id, effect: 'rerun'}); return {...s, status: 'stale'}; }
          if (s.status === 'running') { impact.push({step: s.id, effect: 'restart'}); return {...s, status: 'pending'}; }
          if (s.status === 'pending') impact.push({step: s.id, effect: 'upcoming'});
          return s;
        });
        return settle({...run, inputs: {...run.inputs, [action.key]: action.value}, steps, impact, events: [...run.events, `change:${action.key}`]});
      }
      case 'RERUN_STALE':
        if (run.phase !== 'stale') return run;
        return {...run, phase: 'running', steps: run.steps.map((s) => (s.status === 'stale' ? {...s, status: 'pending'} : s)), events: [...run.events, 'rerun']};
      case 'POST': {
        /* Posting is explicit and never repeats: only sections not already posted go out. */
        if (!['ready', 'partial', 'completed'].includes(run.phase)) return run;
        const fresh = action.sections.filter((x) => !run.posted.includes(x));
        if (!fresh.length) return {...run, lastPost: {duplicate: true, sections: []}, events: [...run.events, 'post-skipped']};
        return settle({...run, posted: [...run.posted, ...fresh], lastPost: {duplicate: false, sections: fresh, reply: run.posted.length > 0}, events: [...run.events, 'post']});
      }
      default:
        return run;
    }
  }

  function statusLine(run, toolNames = (D && D.TOOL_NAMES) || {}) {
    if (run.phase === 'cancelled') return 'Cancelled. Nothing was posted.';
    if (run.phase === 'partial') return 'Partially completed';
    if (run.phase === 'stale') return 'An input changed. Some finished steps need to run again.';
    if (run.phase === 'ready') return 'Ready for review';
    if (run.phase === 'completed') return 'Completed';
    const running = run.steps.find((s) => s.status === 'running');
    if (!running) return 'Starting…';
    return running.tool ? `Reading ${toolNames[running.tool] || running.tool}…` : 'Preparing the result…';
  }

  /* The PM brief, built from the sample sources for the focus and the steps that finished. */
  function buildBrief(run, data = D) {
    const focus = run.inputs.focus || 'onboarding';
    const done = (id) => run.steps.some((s) => s.id === id && s.status === 'done');
    const mails = done('gmail') ? data.PM_SOURCES.gmail.filter((m) => m.focus === focus) : [];
    const msgs = done('slack') ? data.PM_SOURCES.slack.filter((m) => m.focus === focus) : [];
    const counts = {};
    [...mails, ...msgs].forEach((m) => { if (m.theme !== 'praise') counts[m.theme] = [...(counts[m.theme] || []), m.id]; });
    const top = Object.entries(counts).sort((a, b) => b[1].length - a[1].length)[0];
    const theme = top ? {title: data.THEMES[top[0]].title, sources: top[1], emails: top[1].filter((x) => x.startsWith('g')).length, slack: top[1].filter((x) => x.startsWith('s')).length} : null;
    let metric = null;
    if (done('excel')) {
      const ms = data.PM_SOURCES.excel.metrics.filter((m) => m.focus === focus);
      const threshold = run.inputs.threshold || 2;
      metric = ms.map((m) => ({...m, delta: Math.round((m.now - m.prev) * 10) / 10, flagged: Math.abs(m.now - m.prev) >= threshold}));
    }
    return {focus, theme, metric, question: data.OPEN_QUESTIONS[focus] || null, missing: run.steps.filter((s) => s.status === 'failed').map((s) => s.id)};
  }

  /* The developer queue: blockers first, then those ready to review, then the rest. */
  function buildQueue(run, data = D) {
    const blockersFirst = /release blockers/.test(run.inputs.priority || '');
    const rank = (p) => (blockersFirst && p.blocker ? 0 : 2) + (p.ci === 'passing' ? 0 : p.ci === 'pending' ? 0.5 : 1);
    const prs = [...data.PRS].sort((a, b) => rank(a) - rank(b) || b.n - a.n);
    return prs.map((p, i) => ({...p, position: i + 1,
      why: p.blocker && blockersFirst
        ? (p.ci === 'passing' ? 'Blocks the release and CI is green, so a review can land today.' : `Blocks the release, but ${p.failing || 'a check'} is failing. Review after the author fixes it, or flag the failure now.`)
        : p.ci === 'pending' ? 'Not blocking; CI still running.' : 'Not blocking the release.'}));
  }

  const api = {SUGGEST_AFTER, qualifyingRuns, whyNotCounted, suggestionState, inferDraft, WINDOWS, COMPLETIONS, setupQuestions, validateCommand, spokenForm,
    SAVED, MORNING_STEPS, parseInvocation, interpret, createRun, reduceRun, statusLine, buildBrief, buildQueue};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Skills = api;
})(typeof window !== 'undefined' ? window : globalThis);

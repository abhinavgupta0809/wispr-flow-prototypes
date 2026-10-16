/* Renders a concept's metrics (from metrics.js) into any element with data-metrics="fixStrip|thoughtCheck". */
(function () {
  const {el} = window.WFP;
  const M = window.METRICS;

  const row = (label, value) => el('div', {class: 'm-row'}, el('dt', {text: label}), el('dd', {text: value}));

  function ladder(concept) {
    const a = M.anchor;
    return el('div', {class: 'ladder', role: 'img', 'aria-label': `${concept.northStar.name} feeds ${a.metric}, which is an assumed product-level metric`},
      el('div', {class: 'rung inputs'}, el('span', {class: 'rung-label', text: 'Supporting metrics'}), el('strong', {text: concept.supporting.map((s) => s.name).join(' · ')})),
      el('span', {class: 'arrow', 'aria-hidden': 'true', text: '→'}),
      el('div', {class: 'rung star'}, el('span', {class: 'rung-label', text: 'Feature north star'}), el('strong', {text: concept.northStar.name})),
      el('span', {class: 'arrow', 'aria-hidden': 'true', text: '→'}),
      el('div', {class: 'rung anchor'}, el('span', {class: 'rung-label', text: 'Flow-level metric (my assumption)'}), el('strong', {text: a.metric})));
  }

  function metricCard(m, extra) {
    return el('article', {class: 'm-card'},
      el('h4', {text: m.name}),
      el('p', {class: 'm-formula', text: m.formula}),
      el('dl', {}, ...extra.map(([k, v]) => row(k, v))));
  }

  function render(target) {
    const key = target.dataset.metrics;
    const c = M[key];
    const ns = c.northStar;
    const parts = [];
    if (c.gate) parts.push(el('p', {class: 'm-gate'}, el('span', {class: 'tag tag-unverified', text: 'Conditional'}), ' ', c.gate));
    parts.push(ladder(c));
    parts.push(el('article', {class: 'block proposed'},
      el('div', {class: 'button-row'}, el('span', {class: 'tag tag-proposed', text: 'Proposed north star'}), el('span', {class: 'muted', text: ns.direction})),
      el('h3', {class: 'm-star', text: ns.name}),
      el('dl', {class: 'm-def'}, row('Formula', ns.formula), row('Population', ns.population), row('Period', ns.period), row('Excludes', ns.exclusions), row('Decision it controls', ns.decision)),
      el('p', {class: 'muted'}, el('strong', {text: 'Why this one: '}), ns.why),
      el('p', {class: 'muted'}, el('span', {class: 'tag tag-hypothesis', text: 'Assumption'}), ' ', ns.caveat.replace(/^Assumption: /, '')),
      el('details', {class: 'stedii'}, el('summary', {text: 'STEDII check'}),
        el('dl', {}, ...ns.stedii.map(([k, v]) => row(k, v))))));
    parts.push(el('h3', {class: 'm-sub', text: 'Supporting metrics: the faster signals that drive it'}));
    parts.push(el('div', {class: 'm-grid'}, ...c.supporting.map((s) => metricCard(s, [['Direction', s.direction], ['Decision', s.decision]]))));
    parts.push(el('h3', {class: 'm-sub', text: 'Guardrails: must not get worse'}));
    parts.push(el('div', {class: 'm-grid'}, ...c.guardrails.map((g) => metricCard(g, [['Threshold', g.threshold], ['If breached', g.action]]))));
    parts.push(el('div', {class: 'block'}, el('h3', {text: 'Kill criteria'}), el('ul', {class: 'ticks'}, ...c.kill.map((k) => el('li', {text: k}))),
      el('p', {class: 'muted', text: 'No baselines: I don’t have Wispr’s data, so no current values are shown. Thresholds marked proposed are starting points to reset once baselines and their variance are known. Never-events are zero by definition.'})));
    target.replaceChildren(...parts);
  }

  document.addEventListener('DOMContentLoaded', () => document.querySelectorAll('[data-metrics]').forEach(render));
})();

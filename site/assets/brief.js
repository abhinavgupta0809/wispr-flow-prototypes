/* The one-minute metrics summary: north star, guardrails, supporting. Reads metrics.js; the full plan
   (usability test, formulas, thresholds, kill criteria) stays in metrics-view.js under Research. Also fills
   [data-proof-quote="key:index"] with a verbatim review quote from evidence.js. */
(function () {
  const {el, fmtDate} = window.WFP;
  const short = (t) => (/^zero/i.test(t) ? 'never' : t.replace(/\s*\(proposed\)/i, '').replace(/^At most /i, '≤ ').replace(/^No higher than /i, '≤ ').replace(/^Below the /i, '< '));
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-metrics-brief]').forEach((box) => {
      const c = window.METRICS[box.dataset.metricsBrief];
      const ns = c.northStar;
      box.replaceChildren(
        el('article', {class: 'bm-card star'}, el('span', {class: 'bm-label', text: 'North star'}), el('p', {class: 'bm-name', text: ns.name}), el('p', {class: 'bm-formula', text: ns.formula})),
        el('article', {class: 'bm-card'}, el('span', {class: 'bm-label', text: 'Guardrails'}),
          el('ul', {class: 'bm-list'}, ...c.guardrails.slice(0, 4).map((g) => el('li', {}, el('span', {text: g.name}), el('span', {class: 'th', text: short(g.threshold)}))))),
        el('article', {class: 'bm-card'}, el('span', {class: 'bm-label', text: 'Supporting'}),
          el('ul', {class: 'bm-list'}, ...c.supporting.slice(0, 4).map((s) => el('li', {}, el('span', {text: s.name}))))));
      box.after(el('p', {class: 'bm-gate'}, el('strong', {text: 'Test first: '}), c.validation.question, ' Full plan under Research.'));
    });
    document.querySelectorAll('[data-proof-quote]').forEach((box) => {
      const [key, i] = box.dataset.proofQuote.split(':');
      const r = window.EVIDENCE[key][Number(i)];
      box.replaceChildren(el('q', {text: r.quote}), el('span', {class: 'muted', text: `${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} ${r.platform === 'ios' ? 'iOS' : 'Android'} review, ${fmtDate(r.date)}`}));
    });
  });
})();

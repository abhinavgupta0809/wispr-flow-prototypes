/* Voice Skills page: the Snippets docs quote and the adjacent review signals. */
(function () {
  const {el, fmtDate} = window.WFP;
  const E = window.EVIDENCE;
  document.addEventListener('DOMContentLoaded', () => {
    const d = E.docs.snippets;
    document.getElementById('snip-quote').textContent = d.quote;
    document.getElementById('snip-link').href = d.url;
    document.getElementById('snip-read').textContent = `(${d.platforms}; read ${fmtDate('2026-10-16')})`;
    const item = (r) => el('li', {},
      el('span', {class: 'tag tag-evidence', text: 'Adjacent signal'}), ' ',
      el('q', {text: r.quote}), ' ',
      el('span', {class: 'muted small', text: `${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} · ${fmtDate(r.date)} · ${r.platform === 'ios' ? 'iOS' : 'Android'} · review ${r.id}. ${r.context}`}));
    const [first, ...others] = E.voiceSkills;
    document.getElementById('adjacent').replaceChildren(item(first),
      el('li', {}, el('details', {}, el('summary', {class: 'muted small', text: `${others.length} more adjacent signals`}), el('ul', {class: 'plain adjacent'}, ...others.map(item)))));
  });
})();

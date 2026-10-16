/* Overview: the metric tree, drawn from metrics.js so the numbers on every page agree. */
(function () {
  const {el} = window.WFP;
  const M = window.METRICS;
  const ORDER = [
    ['voiceSkills', 'Voice Skills', 'voice-skills/'],
    ['fixStrip', 'Phrase Repair', 'phrase-repair/'],
    ['reviewRevisions', 'Review Revisions', 'review-revisions/'],
    ['journalMode', 'Journal Mode', 'journal-mode/'],
  ];

  document.addEventListener('DOMContentLoaded', () => {
    const tree = document.getElementById('metric-tree');
    tree.replaceChildren(
      el('div', {class: 'root'}, el('span', {class: 'lab', text: 'Flow-level goal (my assumption)'}), el('strong', {text: M.anchor.metric})),
      el('div', {class: 'branches'}, ...ORDER.map(([key, name, href], i) => {
        const c = M[key];
        return el('a', {class: 'branch', href: `${href}#${{voiceSkills: 'vs-measure-h', fixStrip: 'measure-h', reviewRevisions: 'rr-measure-h', journalMode: 'jm-measure-h'}[key]}`},
          el('span', {class: 'b-n', text: String(i + 1).padStart(2, '0')}),
          el('span', {class: 'b-name', text: name}),
          el('span', {class: 'lab', text: 'North star'}),
          el('strong', {class: 'b-star', text: c.northStar.name}),
          el('span', {class: 'lab', text: 'Test first'}),
          el('span', {class: 'b-q', text: c.validation.question}));
      })));
  });
})();

/* The film: a clear play button first, native controls once it plays. */
document.addEventListener('DOMContentLoaded', () => {
  const v = document.getElementById('film-video');
  const b = document.getElementById('film-play');
  if (!v || !b) return;
  b.addEventListener('click', () => { v.controls = true; b.hidden = true; v.play().catch(() => {}); });
  v.addEventListener('play', () => { v.controls = true; b.hidden = true; });
});

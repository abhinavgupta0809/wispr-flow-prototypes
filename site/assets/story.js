/* The thread through the four proposals: where you are in the story, and what comes next. */
(function () {
  const STORY = [
    {page: 'voice-skills', name: 'Voice Skills', when: 'When the work is a routine'},
    {page: 'phrase-repair', name: 'Phrase Repair', when: 'When one phrase comes out wrong'},
    {page: 'review-revisions', name: 'Review Revisions', when: 'When you change your mind mid-sentence'},
    {page: 'journal-mode', name: 'Journal Mode', when: 'When the words are the point'},
  ];
  document.addEventListener('DOMContentLoaded', () => {
    const {el} = window.WFP;
    const page = document.body.dataset.page;
    const i = STORY.findIndex((s) => s.page === page);
    const intro = document.querySelector('.page-intro');
    if (i >= 0 && intro) {
      intro.prepend(el('ol', {class: 'story-dots', 'aria-label': 'The four proposals'}, ...STORY.map((s, j) => el('li', {class: j === i ? 'on' : j < i ? 'past' : ''},
        el('a', {href: j === i ? '#' : `../${s.page}/`, 'aria-current': j === i ? 'step' : null}, el('span', {class: 'dot-n', text: String(j + 1)}), el('span', {class: 'dot-name', text: s.name}))))));
    }
    const main = document.querySelector('main');
    if (!main) return;
    if (page === 'research') {
      main.append(el('nav', {class: 'story-nav', 'aria-label': 'Continue the story'},
        el('a', {class: 'story-card prev', href: '../journal-mode/'}, el('span', {class: 'sc-dir', text: '← Previous'}), el('span', {class: 'sc-when', text: STORY[3].when}), el('strong', {class: 'sc-name', text: STORY[3].name})),
        el('a', {class: 'story-card next', href: '../'}, el('span', {class: 'sc-dir', text: 'Back to the start →'}), el('span', {class: 'sc-when', text: 'Four moments, one idea'}), el('strong', {class: 'sc-name', text: 'Overview'}))));
      return;
    }
    const prev = i > 0 ? STORY[i - 1] : null;
    const next = i >= 0 && i < STORY.length - 1 ? STORY[i + 1] : null;
    const card = (s, dir) => el('a', {class: `story-card ${dir}`, href: s ? `../${s.page}/` : '../'},
      el('span', {class: 'sc-dir', text: dir === 'prev' ? '← Previous' : s ? 'Next →' : 'Back to the overview →'}),
      el('span', {class: 'sc-when', text: s ? s.when : 'Four moments, one idea'}),
      el('strong', {class: 'sc-name', text: s ? s.name : 'Overview'}));
    main.append(el('nav', {class: 'story-nav', 'aria-label': 'Continue the story'},
      i <= 0 ? el('a', {class: 'story-card prev', href: '../'}, el('span', {class: 'sc-dir', text: '← Overview'}), el('span', {class: 'sc-when', text: 'Let your voice finish the job'}), el('strong', {class: 'sc-name', text: 'Start'})) : card(prev, 'prev'),
      card(next, 'next')));
  });
})();

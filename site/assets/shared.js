/* Shared page chrome: theme switch, element helper, and the review quote card. */
(function () {
  const THEME_KEY = 'wfp-theme';
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage blocked: theme just won't persist */ } },
  };
  const saved = storage.get(THEME_KEY);
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) if (child !== null && child !== undefined && child !== false) node.append(child);
    return node;
  }

  const fmtDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});

  function quoteCard(item) {
    const E = window.EVIDENCE;
    const store = E.STORES[item.platform];
    const where = item.platform === 'ios' ? `iOS${item.country ? `, ${item.country}` : ''}` : 'Android';
    return el('article', {class: 'block evidence quote'},
      el('div', {class: 'button-row'}, el('span', {class: 'tag tag-evidence', text: 'Customer evidence'}), el('span', {class: 'muted', text: item.theme})),
      el('blockquote', {text: item.quote}),
      el('p', {class: 'meta'},
        `${'★'.repeat(item.rating)}${'☆'.repeat(5 - item.rating)} · ${fmtDate(item.date)} · ${where} · app ${item.version}`, el('br'),
        'Review ID ', el('code', {text: item.id}), ' (no per-review store link; find it in the ',
        el('a', {href: E.EXPORT_CSV, text: 'export CSV'}), ')', el('br'),
        el('a', {href: E.deepDive(item.group), target: '_blank', rel: 'noopener', text: `Dashboard: ${item.group}`}), ' · ',
        el('a', {href: store.url, target: '_blank', rel: 'noopener', text: store.name})),
      el('p', {class: 'why', text: item.context}));
  }

  function wireTheme() {
    const button = document.getElementById('theme');
    if (!button) return;
    button.addEventListener('click', () => {
      const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
      const next = dark ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      storage.set(THEME_KEY, next);
    });
  }
  document.addEventListener('DOMContentLoaded', wireTheme);

  window.WFP = {el, fmtDate, quoteCard, storage};
})();

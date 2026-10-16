/* Overview: review links for the lead proposal and the docs lines Flow ships today. */
(function () {
  const {el, fmtDate} = window.WFP;
  const E = window.EVIDENCE;

  const links = (items) => {
    const out = [];
    items.forEach((item, i) => {
      if (i) out.push(' · ');
      out.push(el('a', {href: E.deepDive(item.group), target: '_blank', rel: 'noopener', title: `Review ${item.id}`, text: `“${item.quote.length > 70 ? item.quote.slice(0, 68).replace(/\s+\S*$/, '') + '…' : item.quote}”`}));
    });
    return out;
  };

  document.addEventListener('DOMContentLoaded', () => {
    const d = E.docs;
    document.getElementById('fs-evidence').replaceChildren(...links(E.fixStrip));
    document.getElementById('read-on').textContent = `re-read ${fmtDate(d.readOn)}`;
    const q = (text, doc) => el('li', {}, `“${text}” `, el('a', {href: doc.url, target: '_blank', rel: 'noopener', text: doc.title}));
    document.getElementById('today-quotes').replaceChildren(
      q(d.transforms.beta, d.transforms),
      q(d.transforms.platforms, d.transforms),
      q(d.commandMode.quote, d.commandMode),
      el('li', {text: 'I haven’t yet checked the current iPhone keyboard myself, so no page here claims a capability is missing on mobile beyond what the docs say.'}));
  });
})();

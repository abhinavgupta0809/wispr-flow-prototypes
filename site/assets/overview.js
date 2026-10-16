/* Overview: evidence links and, if this browser holds a Thought Check workspace, its progress. */
(function () {
  const {el, storage} = window.WFP;
  const E = window.EVIDENCE;
  const TC = window.ThoughtCheck;

  const links = (items) => {
    const out = [];
    items.forEach((item, i) => {
      if (i) out.push(' · ');
      out.push(el('a', {href: E.deepDive(item.group), target: '_blank', rel: 'noopener', title: `Review ${item.id}`, text: `“${item.quote.length > 70 ? item.quote.slice(0, 68).replace(/\s+\S*$/, '') + '…' : item.quote}”`}));
    });
    return out;
  };

  function progress() {
    const raw = storage.get('wfp-thoughtcheck-v1');
    if (!raw) return 'No results yet. The experiment runs in the Thought Check workspace.';
    try {
      const s = TC.summarize(TC.parseImport(raw)).controlled;
      if (!s.primaryRuns) return 'No completed runs yet.';
      return `In this browser: ${s.primaryRuns} of ${s.passagesTotal} passages assessed, ${s.totals.assessed} meaning units, ${s.flagged.length} needing substantive correction. Small-experiment findings only.`;
    } catch { return 'No readable results in this browser.'; }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('fs-evidence').replaceChildren(...links(E.fixStrip));
    document.getElementById('tc-evidence').replaceChildren(...links(E.thoughtCheck));
    document.getElementById('tc-progress').textContent = progress();
  });
})();

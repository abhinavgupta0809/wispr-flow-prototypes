/* Word-level diff for previews and the captured/polished comparison. Pure, no DOM.
   diffWords(a, b) returns parts {type: 'same' | 'del' | 'ins', text}. Joining the 'same' and 'del' parts
   gives back a; joining 'same' and 'ins' gives back b. */
(function (root) {
  const split = (text) => text.match(/\s+|[^\s]+/g) || [];

  function diffWords(a, b) {
    const x = split(a);
    const y = split(b);
    const n = x.length;
    const m = y.length;
    const lcs = Array.from({length: n + 1}, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
    const parts = [];
    const push = (type, text) => {
      const last = parts[parts.length - 1];
      if (last && last.type === type) last.text += text;
      else parts.push({type, text});
    };
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (x[i] === y[j]) { push('same', x[i]); i++; j++; }
      else if (lcs[i + 1][j] >= lcs[i][j + 1]) push('del', x[i++]);
      else push('ins', y[j++]);
    }
    while (i < n) push('del', x[i++]);
    while (j < m) push('ins', y[j++]);
    return tidy(parts);
  }

  /* Whitespace alone between two changes reads better inside the change than as a "same" gap. */
  function tidy(parts) {
    const out = [];
    let del = '';
    let ins = '';
    const flush = () => {
      if (del) out.push({type: 'del', text: del});
      if (ins) out.push({type: 'ins', text: ins});
      del = ''; ins = '';
    };
    parts.forEach((p, k) => {
      const inChange = del || ins;
      const next = parts[k + 1];
      if (p.type === 'del') del += p.text;
      else if (p.type === 'ins') ins += p.text;
      else if (inChange && /^\s+$/.test(p.text) && next && next.type !== 'same') { del += p.text; ins += p.text; }
      else { flush(); out.push({...p}); }
    });
    flush();
    return out;
  }

  const sideOf = (parts, side) => parts.filter((p) => p.type === 'same' || p.type === side).map((p) => p.text).join('');

  const api = {diffWords, sideOf};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TextDiff = api;
})(typeof window !== 'undefined' ? window : globalThis);

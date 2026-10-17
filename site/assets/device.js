/* Desktop / Phone preview toggle for the proposal pages. Sets body[data-device] and fires `wfp:device`.
   The choice is a per-viewer convenience kept in localStorage, so it carries from page to page.
   ?device=phone|desktop overrides it; otherwise the page's data-device-default applies. */
(function () {
  const KEY = 'wfp-device';
  const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const write = (v) => { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode: ignore */ } };
  const ICONS = {
    desktop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/></svg>',
  };
  function apply(v) {
    document.body.dataset.device = v;
    document.querySelectorAll('[data-device-toggle] button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.device === v)));
    window.dispatchEvent(new CustomEvent('wfp:device', {detail: v}));
  }
  document.addEventListener('DOMContentLoaded', () => {
    const bars = document.querySelectorAll('[data-device-toggle]');
    if (!bars.length) return;
    bars.forEach((bar) => {
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', 'Preview on');
      bar.replaceChildren(...['desktop', 'phone'].map((d) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.device = d;
        b.innerHTML = `${ICONS[d]}<span>${d === 'desktop' ? 'Desktop' : 'Phone'}</span>`;
        b.addEventListener('click', () => { write(d); apply(d); });
        return b;
      }));
    });
    const param = new URLSearchParams(location.search).get('device');
    const pick = [param, read(), document.body.dataset.deviceDefault, 'desktop'].find((v) => v === 'desktop' || v === 'phone');
    apply(pick);
  });
})();

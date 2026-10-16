/* The phrase editor: one component shared by Mobile Fix Strip, Journal Mode and Review Revisions.
   Tap words to select a phrase, say (simulated) or type the replacement, preview, then apply or cancel.
   State lives in the tested core (fixstrip-core.js). The host page owns the text view and, after Apply,
   decides where the change goes and how Undo works.

   PhraseEditor.create({words, controls, onChange, onApply, frame, compact}) returns an editor:
     begin(text, phrases)  load text and open the word strip
     dispatch(action)      any FixStrip core action
     isEditing()           a phrase is being chosen, replaced or previewed
     textNodes()           the host's text with the selection or preview marked, or null
     reset()               back to empty */
(function () {
  const {el} = window.WFP;
  const FS = window.FixStrip;
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EDITING = ['strip', 'replace', 'preview'];

  function create(opts) {
    const ed = {state: FS.initialState(), listening: false};
    let key = '';
    let timers = [];
    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const frame = opts.frame || ((label, body) => body);

    ed.isEditing = () => EDITING.includes(ed.state.phase);

    const focusInside = () => {
      const a = document.activeElement;
      return !!a && ((opts.controls && opts.controls.contains(a)) || (opts.words && opts.words.contains(a)));
    };
    let focusWas = false;

    ed.dispatch = (action) => {
      focusWas = focusInside();
      const prev = ed.state;
      ed.state = FS.reduce(ed.state, action);
      if (ed.state === prev) return;
      if (action.type === 'RESET') { timers.forEach(clearTimeout); timers = []; ed.listening = false; }
      if (action.type === 'APPLY' && opts.onApply) opts.onApply(ed.state.lastChange, ed);
      ed.render();
      if (opts.onChange) opts.onChange(action, ed);
    };

    ed.begin = (text, phrases) => {
      timers.forEach(clearTimeout); timers = [];
      ed.listening = false;
      ed.state = FS.reduce(FS.reduce(FS.initialState(), {type: 'LOAD', text, phrases}), {type: 'OPEN_STRIP'});
      key = '';
      ed.render();
      if (opts.onChange) opts.onChange({type: 'BEGIN'}, ed);
    };

    ed.reset = () => ed.dispatch({type: 'RESET'});

    ed.textNodes = () => {
      const preview = FS.previewText(ed.state);
      if (preview) return [preview.before, el('del', {text: preview.removed}), el('ins', {text: preview.inserted}), preview.after];
      const range = FS.selectionRange(ed.state);
      if (range && ed.isEditing()) return [ed.state.text.slice(0, range.start), el('mark', {text: range.phrase}), ed.state.text.slice(range.end)];
      return null;
    };

    function say() {
      const range = FS.selectionRange(ed.state);
      const phrase = range && FS.simulatedReplacementFor(range.phrase, ed.state.simulated);
      if (!phrase || ed.listening) return;
      if (reduceMotion()) { ed.dispatch({type: 'SET_REPLACEMENT', text: phrase, simulated: true}); ed.dispatch({type: 'PREVIEW'}); return; }
      ed.listening = true; ed.render();
      later(() => {
        ed.listening = false;
        ed.dispatch({type: 'SET_REPLACEMENT', text: phrase, simulated: true});
        later(() => ed.dispatch({type: 'PREVIEW'}), 250);
      }, 1000);
    }

    const button = (label, attrs = {}) => el('button', {...attrs, type: 'button', class: `key ${attrs.class || ''}`.trim()}, label);

    function renderWords() {
      if (!opts.words) return;
      if (!ed.isEditing()) { opts.words.replaceChildren(); return; }
      const interactive = ed.state.phase === 'strip';
      const sel = ed.state.sel;
      const focusedIndex = opts.words.contains(document.activeElement) ? document.activeElement.dataset.i : null;
      opts.words.replaceChildren(...FS.dictationTokens(ed.state).map((t, i) => {
        if (!t.word) return el('span', {class: 'p', text: t.text});
        const on = sel && i >= sel.from && i <= sel.to;
        return el('button', {type: 'button', class: `w${t.text === '[unclear]' ? ' unclear' : ''}`, 'aria-pressed': on ? 'true' : 'false', disabled: !interactive && !on, tabindex: interactive ? null : '-1', onclick: () => ed.dispatch({type: 'TAP', index: i}), 'data-i': String(i), text: t.text});
      }));
      if (focusedIndex !== null && interactive) opts.words.querySelector(`[data-i="${focusedIndex}"]`)?.focus({preventScroll: true});
    }

    function renderControls() {
      const box = opts.controls;
      if (!box) return;
      const range = FS.selectionRange(ed.state);
      const next = [ed.state.phase, range ? `${range.start}-${range.end}` : '', ed.listening].join('|');
      if (next === key) { syncPreview(); return; }
      key = next;
      if (!ed.isEditing()) { box.replaceChildren(); return; }
      let body;
      let focus = null;
      const phase = ed.state.phase;
      if (phase === 'strip') {
        const replace = button('Replace selection', {class: 'primary', disabled: !range, onclick: () => ed.dispatch({type: 'START_REPLACE'})});
        body = frame('Fix', el('div', {class: 'pe-body'},
          el('p', {class: 'hint', text: range ? `Selected “${range.phrase}”. Tap another word to extend the phrase.` : 'Tap the word to change.'}),
          el('div', {class: 'kb-row'}, replace, button('Close', {onclick: () => ed.dispatch({type: 'CLOSE_STRIP'})}))));
        focus = range ? replace : null;
      } else if (phase === 'replace') {
        const prepared = FS.simulatedReplacementFor(range.phrase, ed.state.simulated);
        const mic = el('button', {type: 'button', class: `mic${ed.listening ? ' listening' : ''}`, disabled: !prepared, onclick: say, 'aria-label': 'Say the replacement (simulated)'}, ed.listening ? '…' : 'Say it');
        const input = el('input', {type: 'text', class: 'pe-input', placeholder: 'or type the replacement', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Type the replacement'});
        input.value = ed.state.replacement;
        input.addEventListener('input', () => ed.dispatch({type: 'SET_REPLACEMENT', text: input.value}));
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ed.dispatch({type: 'PREVIEW'}); });
        body = frame('Replace', el('div', {class: 'pe-body'},
          el('p', {class: 'replace-target'}, 'Replace ', el('b', {text: range.phrase}), ' with…'),
          el('div', {class: 'pe-say'}, mic, el('span', {class: 'sim-note', text: ed.listening ? 'Simulated listening' : prepared ? `Simulated: fills in “${prepared}”` : 'No prepared phrase for this selection: type instead'})),
          input,
          el('div', {class: 'kb-row'}, button('Preview', {class: 'primary', 'data-pe': 'preview', onclick: () => ed.dispatch({type: 'PREVIEW'})}), button('Cancel', {onclick: () => ed.dispatch({type: 'CANCEL'})}))));
        focus = prepared && !opts.compact ? mic : input;
      } else if (phase === 'preview') {
        const apply = button('Apply', {class: 'primary', onclick: () => ed.dispatch({type: 'APPLY'})});
        body = frame('Preview', el('div', {class: 'pe-body'},
          el('p', {class: 'swap'}, el('s', {text: range.phrase}), ' → ', el('b', {text: ed.state.replacement})),
          el('p', {class: 'hint', text: 'Only this phrase changes. Everything else stays as it is.'}),
          el('div', {class: 'kb-row'}, apply, button('Change', {onclick: () => ed.dispatch({type: 'EDIT'})}), button('Cancel', {onclick: () => ed.dispatch({type: 'CANCEL'})}))));
        focus = apply;
      }
      const hadFocus = focusWas || focusInside();
      box.replaceChildren(...[body].flat());
      syncPreview();
      if (focus && hadFocus) focus.focus({preventScroll: true});
    }

    function syncPreview() {
      const b = opts.controls && opts.controls.querySelector('[data-pe=preview]');
      if (b) b.disabled = !ed.state.replacement.trim();
    }

    ed.render = () => { renderWords(); renderControls(); };
    return ed;
  }

  window.PhraseEditor = {create};
})();

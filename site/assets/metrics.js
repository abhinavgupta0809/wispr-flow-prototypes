/* Success metrics for both concepts, chosen with the PM-OS /define-north-star and /feature-metrics
   skills (STEDII check). No Wispr baselines are available to me, so every threshold is a proposed
   starting point to reset once a baseline and its variance are known. Never-events are the exception:
   their threshold is zero by definition. */
(function (root) {
  const anchor = {
    quote: 'The fastest way to write. Just speak, and Flow types for you in any app, in over 100 languages.',
    source: 'Wispr Flow help center footer, read 2026-10-15',
    metric: 'Weekly kept dictations per active user',
    definition: 'Dictations that are sent or kept without being deleted and retyped, per weekly active user.',
    label: 'Assumption: Wispr’s own north star is not public. This is my stand-in, to show what both feature metrics feed.',
  };

  const fixStrip = {
    northStar: {
      name: 'Time to a correct, send-ready message',
      formula: 'Median seconds from the moment a dictation is inserted to the moment the message is send-ready, over mobile dictations the user edited at least once before sending.',
      population: 'iOS Flow keyboard users eligible for the strip, compared with a randomized holdout without it.',
      period: 'Weekly, read after four full weeks.',
      exclusions: 'Dictations deleted entirely; fields where iOS swaps in the system keyboard (number, phone, email); gaps over two minutes between dictation and send.',
      direction: 'Down is good.',
      decision: 'Ship if the treatment median beats the holdout with a confidence interval that excludes zero and every guardrail holds. If it doesn’t, stop the strip and instrument where the correction time goes instead.',
      why: 'Reviewers describe the cost in time ("They end up costing you time"). Counting only edited dictations keeps the effect from being diluted by the dictations that never needed a fix.',
      caveat: 'Assumption: a keyboard extension can’t see the host app’s Send button. "Send-ready" would be inferred from the text field clearing after it held the message. That needs the same native feasibility check as the strip itself.',
      stedii: [
        ['Sensitive', 'Only edited dictations are in the denominator, so a faster fix shows up directly.'],
        ['Timely', 'Measured per message; a week of traffic gives a reading.'],
        ['Easy', 'Seconds from dictation to a message you’d send.'],
        ['Directional', 'Lower is better, with no ambiguity.'],
        ['Implementable', 'Depends on inferring send-ready from the field clearing (see the caveat).'],
        ['Independent', 'The holdout absorbs app updates, iOS releases and seasonality.'],
      ],
    },
    supporting: [
      {name: 'Keyboard-switch rate on edited dictations', formula: 'Edited dictations where the user left the Flow keyboard before send-ready ÷ edited dictations', direction: 'Down', decision: 'If it doesn’t fall, people still prefer another keyboard to fix things; look at what they type after switching.'},
      {name: 'Strip reach', formula: 'Edited dictations where the strip was opened ÷ edited dictations', direction: 'Up', decision: 'Low reach means the Fix control is missed; test its placement before judging the strip.'},
      {name: 'Strip success', formula: 'Replacements applied and not undone within 10 seconds ÷ strip opens', direction: 'Up', decision: 'Low success means people open the strip and give up; review where they cancel.'},
      {name: 'Spoken share of replacements', formula: 'Replacements supplied by voice ÷ applied replacements', direction: 'Informational', decision: 'If most fixes are typed, the typing path inside the strip matters more than voice input; prioritize it.'},
    ],
    guardrails: [
      {name: 'Text outside the selection changed', formula: 'Applied replacements where any character outside the selected range differs before and after ÷ applied replacements', threshold: 'Zero (never-event)', action: 'Turn the strip off and fix before re-enabling.'},
      {name: 'Quick undo', formula: 'Replacements undone within 10 seconds ÷ applied replacements', threshold: 'At most 10% (proposed)', action: 'Sample undone edits to check for wrong ranges or wrong recognition.'},
      {name: 'Dictations that end up sent', formula: 'Dictations that reach send-ready ÷ dictations started', threshold: 'No more than 1 point below holdout (proposed)', action: 'The strip may be adding friction; check strip opens on dictations that were then abandoned.'},
      {name: 'Strip closed with no action', formula: 'Strip opens closed with no selection ÷ strip opens', threshold: 'At most 40% (proposed)', action: 'Accidental or curious opens; revisit the Fix control’s size and position.'},
      {name: 'Keyboard stability', formula: 'Keyboard crashes and terminations ÷ keyboard sessions', threshold: 'No worse than holdout', action: 'Roll back the strip build.'},
    ],
    kill: ['Any text-integrity never-event in production.', 'Quick undo above 20% for a week (proposed).', 'Dictations that end up sent fall 2 or more points below holdout for a week (proposed).'],
  };

  const thoughtCheck = {
    gate: 'These metrics apply only if the experiment finds meaning losses worth catching. If it doesn’t, there is nothing to measure and the concept stops.',
    northStar: {
      name: 'Faithful sent drafts',
      formula: 'Audited sent drafts in which every meaning unit in the captured audio survives, with no unsupported additions ÷ audited sent drafts.',
      population: 'A random weekly sample of dictations of 40 words or more with cleanup on, from users who opted in to quality review of retained audio. Treatment versus a randomized holdout.',
      period: 'Weekly, read after four full weeks.',
      exclusions: 'Dictations whose audio was not retained under the user’s own settings; unsent drafts.',
      direction: 'Up is good.',
      decision: 'Keep building only if treatment raises the faithful share over holdout. If it doesn’t, the cards aren’t catching what matters, however often people tap them.',
      why: 'The hypothesis is about noticing. What counts is what gets sent, not how many cards appear. Raters use the same meaning-unit rubric as this experiment.',
      caveat: 'It needs a consented audit program and trained raters. That is slow and costly, which is why the supporting metrics below act as faster leading signals.',
      stedii: [
        ['Sensitive', 'Only if meaning loss is common enough to move; the experiment is the first check of that.'],
        ['Timely', 'Weekly, with a rating lag of a few days.'],
        ['Easy', 'Share of sent drafts that still say everything you said.'],
        ['Directional', 'Higher is better.'],
        ['Implementable', 'Needs opt-in audio review and raters.'],
        ['Independent', 'The holdout absorbs model and cleanup changes.'],
      ],
    },
    supporting: [
      {name: 'Card precision', formula: 'Cards a rater confirms as a real omission or change ÷ cards shown (sampled)', direction: 'Up', decision: 'Below the bar, don’t widen the rollout; noisy cards teach people to ignore them.'},
      {name: 'Loss recall on the test set', formula: 'Known meaning-unit losses surfaced as cards ÷ known losses in a scripted test set (this experiment’s passages plus more speakers)', direction: 'Up', decision: 'An offline gate before any launch: if it misses most known losses, it isn’t ready.'},
      {name: 'Restore rate', formula: 'Cards resolved with Restore ÷ cards shown', direction: 'Read with precision', decision: 'High restore with high precision means the cards are useful; high restore with low precision means people accept without checking. Investigate that.'},
      {name: 'Check details use', formula: 'Drafts where Check details was tapped ÷ eligible drafts', direction: 'Up', decision: 'Very low use means the entry point is invisible or not valued; test placement before judging the check.'},
    ],
    guardrails: [
      {name: 'Restore adds something never said', formula: 'Restores that insert content absent from the captured audio or its transcript ÷ restores', threshold: 'Zero (never-event)', action: 'Turn the feature off.'},
      {name: 'No new audio retention', formula: 'Checks run on audio that the user’s settings would not otherwise retain ÷ checks', threshold: 'Zero (never-event)', action: 'Turn the feature off; privacy review.'},
      {name: 'False alarms', formula: 'Cards rated not a real loss, per 100 eligible dictations', threshold: 'At most 2 (proposed)', action: 'Raise the bar for showing a card.'},
      {name: 'Time added before sending', formula: 'Median dictation-to-send time for drafts where Check details was used, minus the same for holdout drafts', threshold: 'At most 5 seconds (proposed)', action: 'Simplify the cards; Flow’s promise is speed.'},
      {name: 'Undo after Restore', formula: 'Restores undone within 10 seconds ÷ restores', threshold: 'At most 15% (proposed)', action: 'Review undone restores for wrong suggestions.'},
    ],
    kill: ['Any never-event.', 'Card precision below 50% after two weeks (proposed).', 'No gain in faithful sent drafts over holdout after four weeks.'],
  };

  root.METRICS = {anchor, fixStrip, thoughtCheck};
})(typeof window !== 'undefined' ? window : globalThis);

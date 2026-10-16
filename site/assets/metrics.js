/* Success metrics and usability tests for the three proposals, chosen with the PM-OS /define-north-star and /feature-metrics
   skills (STEDII check). No Wispr baselines are available to me, so every threshold is a proposed
   starting point to reset once a baseline and its variance are known. Never-events are the exception:
   their threshold is zero by definition. */
(function (root) {
  const anchor = {
    quote: 'The fastest way to write. Just speak, and Flow types for you in any app, in over 100 languages.',
    source: 'Wispr Flow help center footer, read 2026-10-15',
    metric: 'Weekly kept dictations per active user',
    definition: 'Dictations that are sent or kept without being deleted and retyped, per weekly active user.',
    label: 'Assumption: Wispr’s own north star is not public. This is my stand-in, to show what all three feature metrics feed.',
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

  fixStrip.validation = {
    question: 'Is completing the correction faster and easier?',
    compare: 'The same correction made two ways by the same person, order counterbalanced: the fastest path the current Flow iOS keyboard allows (observed on a phone first), and the Fix Strip prototype.',
    tasks: 'Fix “Tuesday” → “Thursday” and “fix trip” → “Fix Strip” in a dictated message.',
    measures: [
      ['Primary', 'Seconds from the dictation appearing to a correct message.'],
      ['Effort', 'Taps, keyboard switches and re-dictations per correction.'],
      ['Ease', 'Single Ease Question (1 to 7) after each task.'],
      ['Integrity', 'Any change outside the intended phrase counts as a failure.'],
    ],
    caveat: 'The prototype’s “Say it” is instant and always right. Time it with typed replacements, or add a realistic recognition delay, so the comparison isn’t flattered.',
    decision: 'Go to a native feasibility spike if the strip is faster and rated easier for most participants with no integrity failures. Otherwise, find out where the time goes before building anything.',
    sample: '6 to 8 iPhone Flow users (proposed). Enough to find usability problems, not to estimate an effect size.',
  };

  const journalMode = {
    gate: 'Journal Mode is a preference hypothesis. These metrics apply only if the usability test shows that some people want the captured version or the choice.',
    validation: {
      question: 'Which version would the user save, and why?',
      compare: 'Each participant records a real journal entry in Journal Mode, then sees Captured and Polished side by side.',
      tasks: 'Turn Journal Mode on (shortcut or button), record, then keep one version. Return to the captured version afterwards.',
      measures: [
        ['Primary', 'Which version they keep: Captured, Polished, or one they edited. Plus their reason, coded afterwards.'],
        ['Unwanted edits', 'Places they mark “I didn’t want this changed,” counted per version.'],
        ['Activation', 'Whether they turn the mode on without help, and by which path.'],
        ['Clarity', 'Whether they can say, mid-recording, which mode they’re in and whether the mic is on.'],
      ],
      caveat: 'This measures preference. It says nothing about recognition accuracy, and none of it should be reported as a transcription improvement.',
      decision: 'Worth building if a meaningful share keep Captured or say they want the choice (one in three, proposed) and few report unwanted edits in the Captured version. If nearly everyone keeps Polished, Auto Cleanup already covers the need.',
      sample: '6 to 8 desktop Flow users who journal or think aloud (proposed).',
    },
    northStar: {
      name: 'Repeat Journal Mode use',
      formula: 'Users who use Journal Mode in at least two of the four weeks after first use ÷ users who used it at least once.',
      population: 'Desktop Flow users in a randomized rollout of Journal Mode.',
      period: 'Monthly cohorts, read four weeks after first use.',
      exclusions: 'Internal and test accounts; activations with no completed recording.',
      direction: 'Up is good.',
      decision: 'If repeat use stays low, the preference isn’t strong enough for its own mode; fold “keep it raw” into the existing Auto Cleanup setting instead.',
      why: 'A preference shows up as coming back, not as one curious try. Repeat use is hard for novelty to fake.',
      caveat: 'Assumption: people who journal by voice do it often enough to show in four weeks. If they journal weekly or less, lengthen the window.',
      stedii: [
        ['Sensitive', 'Counts only people who tried the mode, so a real preference moves it.'],
        ['Timely', 'Four weeks per cohort; slower than the supporting metrics.'],
        ['Easy', 'Did people come back to it?'],
        ['Directional', 'Higher is better.'],
        ['Implementable', 'Needs a mode flag on each recording.'],
        ['Independent', 'Rollout cohorts absorb seasonality and app releases.'],
      ],
    },
    supporting: [
      {name: 'Captured kept', formula: 'Entries kept as Captured ÷ entries where a version was kept', direction: 'Informational', decision: 'If almost nobody keeps Captured, the value is the polish step, not the raw capture; reconsider the mode.'},
      {name: 'Polish rate', formula: 'Journal entries polished ÷ Journal entries', direction: 'Informational', decision: 'Read with Captured kept: polishing then keeping Captured means the comparison itself is useful.'},
      {name: 'Activation path', formula: 'Activations by shortcut ÷ all activations', direction: 'Informational', decision: 'If the shortcut is rarely used, don’t spend a gesture on it; keep the button.'},
      {name: 'Phrase edits per entry', formula: 'Applied phrase edits ÷ Journal entries', direction: 'Down', decision: 'Many edits on Captured mean minimal cleanup is too minimal; tune the capture rules.'},
    ],
    guardrails: [
      {name: 'Capture silently replaced', formula: 'Entries whose Captured version changed without a user edit ÷ Journal entries', threshold: 'Zero (never-event)', action: 'Turn the mode off and fix.'},
      {name: 'Hands-free cancelled by a third tap', formula: 'Hands-free recordings cancelled by a third fn tap ÷ hands-free starts', threshold: 'No higher than holdout', action: 'The shortcut collides with hands-free; move Journal Mode to another binding.'},
      {name: 'Accidental activation', formula: 'Activations turned off within 5 seconds with no recording ÷ activations', threshold: 'At most 10% (proposed)', action: 'Make the shortcut harder to trigger by accident.'},
      {name: 'Unwanted-edit reports', formula: 'Reports of unwanted changes per 100 Journal Mode entries', threshold: 'Below the normal-mode rate (proposed)', action: 'Review the capture rules against the reported entries.'},
    ],
    kill: ['Any never-event.', 'Hands-free cancellations rise above holdout after a fix attempt.', 'Repeat use below 20% for two monthly cohorts (proposed).'],
  };

  const reviewRevisions = {
    gate: 'The usability test comes first: does reviewing beat simply dictating another correction? The production metrics only matter if it does.',
    validation: {
      question: 'Can users inspect and adjust their final decisions accurately?',
      compare: 'Review Revisions against the obvious alternative: dictating another correction (“Actually, drop Sam”). Same scenarios, order counterbalanced.',
      tasks: 'Exclude Sam while keeping Leo and Daniel’s optional status; move the meeting to Friday without changing the time or guests; pick Thursday without confirming it.',
      measures: [
        ['Primary', 'Final-message correctness: every target decision right, and every unrelated decision and condition unchanged.'],
        ['Effort', 'Seconds and actions to a correct message.'],
        ['Ease', 'Single Ease Question (1 to 7) per task.'],
        ['Side effects', 'Unrelated decisions or conditions changed by mistake.'],
      ],
      caveat: 'Re-dictation in the test goes through the real app; Review Revisions is a prototype with prepared cards. Score correctness on the final text only, so both paths are judged the same way.',
      decision: 'Keep it if the controls give equal or better correctness with less effort. If re-dictating is as accurate and as quick, drop the controls.',
      sample: '6 to 8 Flow users who dictate scheduling or planning messages (proposed).',
    },
    northStar: {
      name: 'Correct final messages after spoken revisions',
      formula: 'Audited sent messages from dictations containing a spoken revision, where every final decision matches the speaker’s intent and no unrelated decision changed ÷ audited messages of that kind.',
      population: 'An opt-in quality-review sample, treatment versus a randomized holdout.',
      period: 'Weekly, read after four full weeks.',
      exclusions: 'Dictations without a spoken revision; unsent drafts; audio not retained under the user’s own settings.',
      direction: 'Up is good.',
      decision: 'Keep building only if treatment raises correctness over holdout. Counting opened reviews would reward the control, not the outcome.',
      why: 'The point is that the final choices are right. A tidy-looking review that leaves Sam in the message has failed.',
      caveat: 'Assumption: intent can be judged reliably, by the speaker in a follow-up prompt or by raters with the audio. That is slow and costly, so the supporting metrics lead.',
      stedii: [
        ['Sensitive', 'Only dictations with revisions are counted.'],
        ['Timely', 'Weekly, with a rating lag.'],
        ['Easy', 'Did the message end up saying what you decided?'],
        ['Directional', 'Higher is better.'],
        ['Implementable', 'Needs consented audits and a revision flag.'],
        ['Independent', 'The holdout absorbs model and cleanup changes.'],
      ],
    },
    supporting: [
      {name: 'Review opens', formula: 'Dictations where Review revisions was opened ÷ dictations that showed the control', direction: 'Informational', decision: 'Very low use means the control is missed or not needed; check which before changing it.'},
      {name: 'Change rate', formula: 'Opens with at least one applied change ÷ opens', direction: 'Informational', decision: 'Opens without changes are fine if the message was right; audit a sample to tell.'},
      {name: 'Earlier-choice restores', formula: 'Changes that restore an earlier spoken choice ÷ applied changes', direction: 'Informational', decision: 'If nobody restores, View revisions can be simpler.'},
      {name: 'Source excerpt views', formula: 'Opens where a source excerpt was viewed ÷ opens', direction: 'Informational', decision: 'Tells whether people check the evidence or trust the cards.'},
    ],
    guardrails: [
      {name: 'Card disagrees with the message', formula: 'Reviews where a card shows a value the displayed message doesn’t contain ÷ reviews opened', threshold: 'Zero (never-event)', action: 'Turn the control off.'},
      {name: 'Unrelated decision changed', formula: 'Applied changes that alter a decision or condition the user didn’t touch ÷ applied changes', threshold: 'Zero (never-event)', action: 'Turn the control off and fix.'},
      {name: 'Control shown without a revision', formula: 'Controls shown on dictations with no spoken revision, per 100 dictations', threshold: 'At most 2 (proposed)', action: 'Raise the bar for showing it; it must stay rare and optional.'},
      {name: 'Undo after apply', formula: 'Applied changes undone within 10 seconds ÷ applied changes', threshold: 'At most 15% (proposed)', action: 'Review undone changes for confusing cards.'},
      {name: 'No new audio retention', formula: 'Source excerpts built from audio the user’s settings wouldn’t otherwise keep ÷ excerpts', threshold: 'Zero (never-event)', action: 'Turn excerpts off; privacy review.'},
    ],
    kill: ['Any never-event.', 'The usability test shows re-dictation is as accurate and as fast.', 'No correctness gain over holdout after four weeks.'],
  };

  root.METRICS = {anchor, fixStrip, journalMode, reviewRevisions};
})(typeof window !== 'undefined' ? window : globalThis);

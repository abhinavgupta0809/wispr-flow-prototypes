/* Customer evidence. Every quote is copied verbatim from the reviews dashboard's export
   (wispr-reviews/data/annotated_reviews.csv, scraped 2026-10-11). Store feeds give no per-review
   link, so each review is identified by its export review_id. These are examples of a problem,
   not estimates of how common it is. */
(function (root) {
  const DASHBOARD = 'https://wispr-reviews-site.vercel.app/';
  const deepDive = (group) => `${DASHBOARD}#deep-dive?platform=all&mode=categories&group=${encodeURIComponent(group)}`;
  const STORES = {
    ios: {name: 'App Store', url: 'https://apps.apple.com/app/id6497229487'},
    android: {name: 'Google Play', url: 'https://play.google.com/store/apps/details?id=com.wispr.flowapp'},
  };
  const EXPORT_CSV = `${DASHBOARD}annotated_reviews.csv`;

  const fixStrip = [
    {
      id: 'ios_14588888578', platform: 'ios', country: 'US', date: '2026-09-24', rating: 4, version: '1.76',
      theme: 'Correcting small mistakes',
      quote: 'Going to a seamless keyboard between voice-to-text and minor edits would be ideal without having to add extra steps in the process.',
      context: 'Opens with "The dictation is phenomenal." The complaint is about the moment a quick edit is needed.',
      group: 'Keyboard & App Switching',
    },
    {
      id: 'ios_14606766515', platform: 'ios', country: 'US', date: '2026-09-29', rating: 1, version: '1.76',
      theme: 'Switching between dictation and typing',
      quote: 'I often have to leave the Wispr keyboard if I plan to type a message and then come back to the Wispr keyboard for dictation',
      context: 'Most of this review is about iOS 27 capture failures; this line is the keyboard part.',
      group: 'Keyboard & App Switching',
    },
    {
      id: 'ios_14647561822', platform: 'ios', country: 'US', date: '2026-10-09', rating: 3, version: '1.77',
      theme: 'Editing eats the time dictation saved',
      quote: 'They end up costing you time to where using the app doesn’t even make sense.',
      context: 'About typing on the Flow keyboard in general (search fields, new recipients), not only fixing dictation. Calls Flow "the best voice-to-text app on the market right now."',
      group: 'Keyboard & App Switching',
    },
  ];

  const thoughtCheck = [
    {
      id: 'play_992689aa-a5fc-4125-a004-b7d8c674f486', platform: 'android', country: '', date: '2026-09-09', rating: 4, version: '2.3.1',
      theme: 'Meaning changed by cleanup',
      quote: 'It now rephrases the text so aggressively that often the meaning is completely different, shifting positive and negative signs, making a "he" out of "you." Auto-cleanup setting is light not medium.',
      context: 'An edit to an earlier positive review. The reviewer says it used to need "a lot less to correct manually."',
      group: 'AI Editing & Formatting',
    },
    {
      id: 'play_3e4f2950-07ef-49d6-a69f-7df8cd9140d1', platform: 'android', country: '', date: '2026-08-02', rating: 4, version: '2.1.5',
      theme: 'Dropped words',
      quote: 'Occasionally drops words, changing meaning.',
      context: 'Item 4 of 5 in a list of issues from a heavy user ("680,000+ words dictated in 3 months").',
      group: 'AI Editing & Formatting',
    },
    {
      id: 'play_2626242c-a13a-4678-af80-27ce1f572240', platform: 'android', country: '', date: '2026-04-23', rating: 3, version: '1.7.1',
      theme: 'Words removed or rephrased',
      quote: 'It keeps changing what I’m saying: removing initial or ending words or rephrasing things in a way that becomes frustrating.',
      context: 'Older than the others (April 2026, app 1.7.1). Kept because it names omission and rephrasing separately.',
      group: 'AI Editing & Formatting',
    },
  ];

  /* What Wispr documents today. Read on 2026-10-15 from docs.wisprflow.ai; pages show only
     relative "last updated" dates. Quotes are verbatim. */
  const docs = {
    readOn: '2026-10-15',
    commandMode: {
      url: 'https://docs.wisprflow.ai/articles/4816967992-how-to-use-command-mode',
      title: 'How to use Command Mode',
      quote: 'Available on: Mac, Windows. On iOS, spoken Command Mode phrases can open a web search; in-place text editing is not currently working.',
    },
    transforms: {
      url: 'https://docs.wisprflow.ai/articles/8068950331-how-to-use-transforms-beta',
      title: 'Rewrite text with Transforms and custom prompts',
      quote: 'iOS Polish accepts 10–1,000 words and uses only the selection when text is selected.',
    },
    keyboard: {
      url: 'https://docs.wisprflow.ai/articles/7453988911-Set-up-the-Flow-keyboard-on-iPhone',
      title: 'Set up the Flow keyboard on iPhone',
    },
    autoCleanup: {
      url: 'https://docs.wisprflow.ai/articles/4283510616-auto-cleanup-control-how-much-flow-edits-your-dictation-beta',
      title: 'Auto Cleanup: control how much Flow edits your dictation',
      quote: 'Your original dictation is never lost.',
      note: 'Documented for Mac and Windows: "Undo AI edit" restores the pre-cleanup text.',
    },
    navigating: {
      url: 'https://docs.wisprflow.ai/articles/5096240724-navigating-the-wispr-flow-app-desktop-ios-and-android',
      title: 'Navigating the Wispr Flow App: Desktop, iOS, and Android',
      note: 'On iPhone: "Transcribe again with Flow sends retained audio to the cloud." So the app can hold the audio for a while after dictation.',
    },
  };

  root.EVIDENCE = {DASHBOARD, deepDive, STORES, EXPORT_CSV, fixStrip, thoughtCheck, docs};
})(typeof window !== 'undefined' ? window : globalThis);

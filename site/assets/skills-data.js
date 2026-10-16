/* Voice Skills sample data. Everything here is fictional demo data: people, companies, messages, numbers,
   repositories and links. It is internally consistent so the demo reads like a real morning:
   today is Friday, Oct 16, 2026, and the last successful brief ran Thursday, Oct 15 at 9:04 a.m. */
(function (root) {
  const TODAY = 'Fri, Oct 16, 2026';
  const LAST_RUN = 'Thu, Oct 15, 9:04 a.m.';

  /* Flow-mediated task history (simulated). Only completed, accepted, first-attempt runs of the same
     process count toward a suggestion. */
  const HISTORY = [
    {id: 'r1', when: 'Tue, Oct 13, 8:52 a.m.', signature: 'morning-brief', status: 'completed', accepted: true, retryOf: null,
      request: 'Check the Customer feedback label and #onboarding-feedback since yesterday morning, summarize the Onboarding KPIs funnel table, and draft an update for #product-onboarding.',
      window: 'Since Mon, Oct 12, 9:00 a.m.'},
    {id: 'r2', when: 'Wed, Oct 14, 8:58 a.m.', signature: 'morning-brief', status: 'completed', accepted: true, retryOf: null,
      request: 'Same as yesterday: customer feedback email and #onboarding-feedback since my last brief, the KPIs funnel table, draft for #product-onboarding.',
      window: 'Since Tue, Oct 13, 8:52 a.m.'},
    {id: 'r2b', when: 'Wed, Oct 14, 9:03 a.m.', signature: 'morning-brief', status: 'completed', accepted: true, retryOf: 'r2',
      request: 'Redo that, the Slack draft went to the wrong channel.', window: 'Since Tue, Oct 13, 8:52 a.m.'},
    {id: 'rx', when: 'Wed, Oct 14, 2:15 p.m.', signature: 'reply-draft', status: 'completed', accepted: true, retryOf: null,
      request: 'Draft a reply to Daniel about the pricing page copy.', window: ''},
    {id: 'r3c', when: 'Thu, Oct 15, 8:47 a.m.', signature: 'morning-brief', status: 'cancelled', accepted: false, retryOf: null,
      request: 'Morning brief, same sources.', window: 'Since Wed, Oct 14, 8:58 a.m.'},
    {id: 'r3', when: 'Thu, Oct 15, 9:04 a.m.', signature: 'morning-brief', status: 'ready', accepted: false, retryOf: null,
      request: 'Morning brief: customer feedback label, #onboarding-feedback, KPIs funnel table, draft to #product-onboarding. Since yesterday’s brief.',
      window: 'Since Wed, Oct 14, 8:58 a.m.'},
  ];

  const CONNECTIONS = {gmail: true, slack: true, excel: true, github: true};
  const TOOL_NAMES = {gmail: 'Gmail', slack: 'Slack', excel: 'Excel', github: 'GitHub'};

  /* What the PM brief reads, tagged by focus area. */
  const PM_SOURCES = {
    gmail: [
      {id: 'g1', focus: 'onboarding', from: 'Ops lead, Northwind Logistics (sample)', subject: 'Invites going to spam', snippet: 'Three of our new hires never got the invite. We found it in spam yesterday.', theme: 'invite-spam'},
      {id: 'g2', focus: 'onboarding', from: 'IT admin, Bluefin Dental (sample)', subject: 'Re: Setup help', snippet: 'Our team invites keep getting flagged as junk by our mail filter.', theme: 'invite-spam'},
      {id: 'g3', focus: 'onboarding', from: 'Founder, Cedar & Pine (sample)', subject: 'Quick question', snippet: 'Can I resend an invite? The first one went to spam.', theme: 'invite-spam'},
      {id: 'g4', focus: 'onboarding', from: 'Office manager, Harbor Clinic (sample)', subject: 'Love the checklist', snippet: 'The new setup checklist made day one easy.', theme: 'praise'},
      {id: 'g5', focus: 'retention', from: 'Finance lead, Kestrel Studio (sample)', subject: 'Pausing seats?', snippet: 'Can we pause two seats over the holidays instead of removing them?', theme: 'pause-seats'},
      {id: 'g6', focus: 'retention', from: 'COO, Alder Labs (sample)', subject: 'Seat changes', snippet: 'We would rather pause than cancel for January.', theme: 'pause-seats'},
    ],
    slack: [
      {id: 's1', focus: 'onboarding', channel: '#onboarding-feedback', author: 'CSM (sample)', text: 'Two more accounts this week said invites landed in spam. Both use strict mail filters.', theme: 'invite-spam'},
      {id: 's2', focus: 'onboarding', channel: '#onboarding-feedback', author: 'Support (sample)', text: 'Resend-invite requests are up since Tuesday.', theme: 'invite-spam'},
      {id: 's3', focus: 'retention', channel: '#onboarding-feedback', author: 'CSM (sample)', text: 'Heard “pause instead of cancel” again from a 10-seat team.', theme: 'pause-seats'},
    ],
    excel: {
      workbook: 'Onboarding KPIs.xlsx', sheet: 'Daily', table: 'tbl_funnel',
      asOf: ['Oct 14', 'Oct 15'],
      metrics: [
        {focus: 'onboarding', name: '7-day onboarding completion', unit: '%', prev: 62.4, now: 59.1},
        {focus: 'onboarding', name: 'Day-7 activation', unit: '%', prev: 41.0, now: 40.6},
        {focus: 'retention', name: 'Week-4 retention', unit: '%', prev: 71.2, now: 70.8},
      ],
    },
  };

  const THEMES = {
    'invite-spam': {title: 'Team invites landing in spam', retention: false},
    'pause-seats': {title: 'Customers asking to pause seats instead of cancelling'},
    praise: {title: 'Praise for the setup checklist'},
  };

  const OPEN_QUESTIONS = {
    onboarding: 'Is the completion drop concentrated in teams invited by email? The workbook has no invite-source column, so this brief can’t tell.',
    retention: 'Do pause requests come from one plan tier? The Gmail label doesn’t record plan, so this brief can’t tell.',
  };

  /* Developer sample data: fictional repository and pull requests. Links are in-page anchors. */
  const PRS = [
    {n: 482, title: 'Fix double charge on retried webhooks', author: 'dana-k (sample)', ci: 'passing', blocker: true, size: '+142 −37', note: 'Linked to the release-blocker thread in #payments-release.'},
    {n: 479, title: 'Add idempotency keys to the refund API', author: 'omar-s (sample)', ci: 'failing', failing: 'integration-tests', blocker: true, size: '+311 −58', note: 'Marked blocking in the release checklist.'},
    {n: 476, title: 'Bump payment SDK to 14.2', author: 'renovate (sample)', ci: 'passing', blocker: false, size: '+6 −6', note: 'Routine dependency update.'},
    {n: 471, title: 'Refactor currency formatting', author: 'li-wei (sample)', ci: 'pending', blocker: false, size: '+204 −190', note: 'Large diff; no release impact noted.'},
  ];
  const REPOS = ['payments', 'web-app'];

  root.SkillsData = {TODAY, LAST_RUN, HISTORY, CONNECTIONS, TOOL_NAMES, PM_SOURCES, THEMES, OPEN_QUESTIONS, PRS, REPOS};
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SkillsData;
})(typeof window !== 'undefined' ? window : globalThis);

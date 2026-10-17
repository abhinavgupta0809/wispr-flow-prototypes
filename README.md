# Flow prototypes: Phrase Repair, Journal Mode, Review Revisions, Voice Skills

Independent, unofficial prototypes for a Wispr Flow product application. Not made by or with Wispr.
Part B of run 4 of the reviews work-sample series. The evidence comes from the
[Wispr Flow reviews dashboard](https://wispr-reviews-site.vercel.app/) (repo `~/Desktop/Projects/wispr-reviews`)
and from my own tests in the Flow app.

Positioning: give people more control over how Flow turns speech into writing: quick corrections on
mobile, faithful capture for personal reflection, and reviewable choices after complex revisions.
One storyline, “Let your voice finish the job”: four moments where a daily Flow user still reaches for the keyboard,
in this order: Voice Skills, Phrase Repair, Review Revisions, Journal Mode. All are proposed extensions of what Flow
ships (Transforms, Auto Cleanup, Snippets) and share one Phrase Repair panel. Phrase Repair has the most customer
evidence; Voice Skills is the largest hypothesis.

| Route | What it is | Status |
|---|---|---|
| `/` | Overview: the storyline, the 54s film, four moments, metric tree, why listen to me | Done |
| `/voice-skills/` | Voice Skills, cut for a one-minute look: five steps (Flow spots the routine, save as `/morning`, say it, watch it run, approve the Slack post). One color per tool (Gmail red, Slack aubergine, Excel green, output teal) marks the repeated parts of past requests and the suggested routine. Developer demo, templates, metrics, rules and limits sit in folds under “Go deeper” | Demo done (all connections and data simulated) |
| `/phrase-repair/` | Phrase Repair: manual repair of any phrase plus optional “Check this phrase” marks. Scenarios: name, product term, multiple words, false alarm; iPhone and Android previews | Demo done. Phone comparison waits for a device check |
| `/phrase-repair/?record&scenario=multi&platform=android` | Demo only, for screen recording | Done |
| `/fix-strip/` | Redirects to `/phrase-repair/` | Done |
| `/review-revisions/` | Review Revisions: scenarios A (guest list), B (linked revisions), C (unresolved), plus plain dictation | Demo done (`?record&scenario=…`) |
| `/journal-mode/` | Journal Mode: triple-press fn or button, minimal-cleanup capture, Captured/Polished versions | Demo done (`?record` for recording) |
| `/research/` | Evidence records, the ten-passage test workspace, results | Done. Records need outputs and recordings |
| `/thought-check/` | Redirects to `/research/` (Thought Check was replaced by Review Revisions) | Done |

## Page template (Oct 17)

Every proposal page reads in about a minute, in this order: Problem (one sentence plus one piece of
evidence), Solution (the demo, with a Desktop / Phone toggle), Metrics (north star, guardrails,
supporting, from `metrics.js` via `brief.js`), Trade-offs (three, each with what it beat and what it
costs), then Research (folds: evidence, the full metric plan, docs, limits). Shared files: `app.css`
(template, cream app surfaces, device frame), `device.js` (toggle; the choice is saved in localStorage
under `wfp-device` and carries across pages; `?device=phone|desktop` overrides it), `brief.js`.
Phrase Repair defaults to Phone; the others default to Desktop.

## Run it

No build step, no backend, no dependencies.

```sh
cd ~/Desktop/Projects/wispr-flow-prototypes/site
python3 -m http.server 8731
# open http://localhost:8731/
```

Tests (Node 20 or later, no packages):

```sh
cd ~/Desktop/Projects/wispr-flow-prototypes
node --test tests/*.test.js
```

Live: https://wispr-flow-prototypes.vercel.app/ (Vercel project `wispr-flow-prototypes`, team `abhinav-d561`, deployed
from the CLI with `site/` as the project folder: `cd site && npx vercel deploy --prod`). Not connected to Git, so each
change needs that command. Vercel Web Analytics is enabled; every page loads `/_vercel/insights/script.js`.
`site/.vercelignore` keeps `.env*` files out of deployments.

## Usability tests and metrics

Each proposal page has a “How we'd know it worked” section: the usability test to run first (the question
from `RECORDING-SCRIPTS.md`), then, if it ships, a north star, four supporting metrics, guardrails and kill
criteria. No Wispr baselines are available, so thresholds marked “proposed” are starting points;
never-events are zero. Journal Mode measures preference and unwanted-edit reports, never transcription.
Review Revisions is compared against simply dictating another correction.

## Demo video

Built with the /brag workflow and Hyperframes 0.8.163, rendered locally. Shows all three prototypes. Music: Happy Beats / Business
Moves vol. 10 by ende.app (CC BY 4.0, credit optional, credited on the page). SFX: Kenney (CC0). The
video shows simulated input, labeled on screen.

## What's simulated

- **Phrase Repair marks.** “Check this phrase” spans, their alternatives and what “Say it again” fills in
  are written into each scenario (`SCENARIOS` in `fixstrip-core.js`). No confidence is measured.
- **Voice Skills.** Task history, discovery, tool connections, every email, Slack message, workbook value,
  repository and pull request are fictional (`skills-data.js`). Briefs are built by fixed rules
  (`skills-core.js`), not a model. Nothing is posted anywhere.
- **Speech.** Nothing records or recognizes audio anywhere. Dictations, “Say it again” replacements and the
  journal entry are prepared text. Spoken replacements come from a fixed lookup
  (`SIMULATED_REPLACEMENTS` in `site/assets/fixstrip-core.js`: “Tuesday” → “Thursday”, “fix trip” →
  “Fix Strip”). Anything else must be typed.
- **Fix Strip “fix trip” demo.** The error is one I reported from my own use; the surrounding sentence is scripted.
- **Journal Mode entry.** Two lines are quoted from my journal comparison as given in the brief; the rest is
  scripted and labeled line by line on the page. The Polished version is written by hand.
- **Journal Mode shortcut.** An on-screen fn key (a physical Fn press is counted only if the browser reports
  it). The triple-press window is adjustable on the page (default 750 ms).
- **Review Revisions.** Decisions, earlier choices and excerpts are prepared. Scenario A is a reconstruction
  of my reported intent (no spoken excerpt, no earlier names); B and C use scripted input from the brief.
- **Research workspace.** Nothing. Every output in it is pasted from the real Flow app.

## Open question found while building

Wispr's hands-free doc (re-read 2026-10-16): “Double-tap your push-to-talk shortcut within half a second
of starting: Fn (Mac)…” and “A third rapid push-to-talk tap cancels instead of pasting.” A triple-press of
fn for Journal Mode would collide with that. The Journal Mode page says so and keeps the button as the
dependable path.

## Evidence references

Review quotes are verbatim from `wispr-reviews/data/annotated_reviews.csv` (scraped 2026-10-11).
Store feeds give no per-review link, so each is identified by `review_id`. They are examples of a
problem, not estimates of how common it is. Data lives in `site/assets/evidence.js`.

| Concept | Review ID | Date | Platform | Stars | Theme |
|---|---|---|---|---|---|
| Fix Strip | `ios_14588888578` | 2026-09-24 | iOS US, app 1.76 | 4 | Correcting small mistakes |
| Fix Strip | `ios_14606766515` | 2026-09-29 | iOS US, app 1.76 | 1 | Switching between dictation and typing |
| Fix Strip | `ios_14647561822` | 2026-10-09 | iOS US, app 1.77 | 3 | Editing eats the time saved (about typing in general) |
| Research (was Thought Check) | `play_992689aa-a5fc-4125-a004-b7d8c674f486` | 2026-09-09 | Android, app 2.3.1 | 4 | Meaning changed by cleanup |
| Research (was Thought Check) | `play_3e4f2950-07ef-49d6-a69f-7df8cd9140d1` | 2026-08-02 | Android, app 2.1.5 | 4 | Dropped words |
| Research (was Thought Check) | `play_2626242c-a13a-4678-af80-27ce1f572240` | 2026-04-23 | Android, app 1.7.1 | 3 | Words removed or rephrased |
| Voice Skills (adjacent) | `play_f0b8992f-1b77-4f33-96ae-fdbd25ca1015` | 2026-06-10 | Android, app 2.0.1 | 2 | Snippets used for repeated replies |
| Voice Skills (adjacent) | `play_8c1a0c1f-1e1b-49a4-8885-0b20ccd9e516` | 2026-09-21 | Android, app 2.5.2 | 4 | Typed activation and a list to browse |
| Voice Skills (adjacent) | `ios_12796430925` | 2025-06-20 | iOS HK, app 1.9 | 4 | Commands that can't be discovered |

No review in the export asks for repeatable workflows across tools; the three above are about Snippets and
commands, and are labeled adjacent signals on the page.

Wispr docs read on 2026-10-15 (pages show only relative "last updated" dates):

- [How to use Command Mode](https://docs.wisprflow.ai/articles/4816967992-how-to-use-command-mode):
  "Available on: Mac, Windows. On iOS, spoken Command Mode phrases can open a web search; in-place text
  editing is not currently working."
- [Transforms](https://docs.wisprflow.ai/articles/8068950331-how-to-use-transforms-beta): "iOS Polish
  accepts 10–1,000 words and uses only the selection when text is selected."
- [Auto Cleanup](https://docs.wisprflow.ai/articles/4283510616-auto-cleanup-control-how-much-flow-edits-your-dictation-beta):
  Mac and Windows; "Undo AI edit" restores the pre-cleanup text.
- [Navigating the app](https://docs.wisprflow.ai/articles/5096240724-navigating-the-wispr-flow-app-desktop-ios-and-android):
  on iPhone, "Transcribe again with Flow sends retained audio to the cloud."
- [Create and use snippets](https://docs.wisprflow.ai/articles/5784437944-create-and-use-snippets) (read
  2026-10-16): "If you keep retyping signatures, addresses, or replies, save them as snippets and speak a
  trigger phrase to insert them." Available on Mac, Windows, iOS, Android.
- One web search summary mentioned a "Voice Edit" button on the iOS keyboard. I could not find it in
  Wispr's docs. Unverified: check on the phone.

## Research: records and the ten tests

The Research page keeps the original Thought Check experiment and adds evidence records.

- **Evidence records** (`records-core.js`) hold my reported readings from Oct 16, 2026: the ten passages
  largely kept their meaning; the journal comparison largely kept tone and details; several corrections
  resolved; guest attempt 1 added Sam back on purpose; guest attempt 2 kept Sam when I meant to drop Sam;
  the scheduling output used “the smaller group” without naming it; “Mobile Fix Strip” came out as
  “mobile fix trip.” Each record has fields for what I actually said, intended final choices, the actual
  Flow output, the recording reference, whether it was independently verified, and the correction I
  wanted. Unsupplied fields are empty. Edits save per browser; export JSON or CSV.
- **Test workspace.** Same as before (stored under the old key, so earlier runs still load), plus the same
  evidence fields on every run. A run where I said something other than the script is marked “Said
  something different”: it stays valid and is judged against what I actually said.
- The main pass counts one valid run per passage; recurrence repeats never enter the totals. No
  pre-cleanup transcript means every discrepancy is end-to-end. Results are this experiment's findings,
  not Flow's error rate.

## Files

| Path | What |
|---|---|
| `site/index.html`, `site/assets/overview.js`, `overview.css` | Overview: the storyline, the film, four moments, metric tree, why listen to me |
| `site/assets/story.js` | The thread across the four proposal pages: moment dots and previous/next |
| `site/assets/fixstrip-core.js` | Phrase Repair core shared by every demo: selection, marks, alternatives, repeat, keep as written, apply, undo (tested) |
| `site/assets/phrase-editor.js`, `phrase-editor.css` | The shared repair panel component |
| `site/phrase-repair/index.html`, `site/assets/fixstrip.js`, `fixstrip.css` | Phrase Repair page and phone demo (iPhone and Android) |
| `site/journal-mode/index.html`, `site/assets/journal-core.js`, `journal.js`, `journal.css` | Journal Mode (core tested) |
| `site/review-revisions/index.html`, `site/assets/revisions-core.js`, `revisions.js`, `revisions.css` | Review Revisions (core tested) |
| `site/voice-skills/index.html`, `site/assets/skills-core.js`, `skills-data.js`, `voice-skills.js`, `voice-skills-static.js`, `voice-skills.css` | Voice Skills (core tested; data fictional) |
| `site/assets/textdiff.js` | Word diff for previews and comparisons (tested) |
| `site/research/index.html`, `site/assets/records-core.js`, `records.js`, `thoughtcheck-core.js`, `thoughtcheck.js`, `thoughtcheck.css` | Research page: records, workspace, results |
| `site/assets/evidence.js` | Review quotes and Wispr docs quotes |
| `site/assets/metrics.js`, `metrics-view.js` | Usability tests and metrics for every proposal |
| `tools/metrics-md.js` | Prints the metrics as markdown (`node tools/metrics-md.js`) |
| `site/assets/video/flow-prototypes.mp4` | Demo video (54s), all four proposals in story order. Source: `PM-OS/projects/wispr-reviews/03-outputs/brag-2026-10-16-100245/` |
| `site/assets/shared.js`, `styles.css` | Theme, helpers, shared tokens (Wispr palette, same as the dashboard) |
| `RECORDING-SCRIPTS.md` | Four video scripts and what each validates |
| `tests/` | `node --test` unit tests for the cores |

# Two Flow prototypes: Mobile Fix Strip and Thought Check

Independent, unofficial prototypes for a Wispr Flow product application. Not made by or with Wispr.
Part B of run 4 of the reviews work-sample series. The evidence comes from the
[Wispr Flow reviews dashboard](https://wispr-reviews-site.vercel.app/) (repo `~/Desktop/Projects/wispr-reviews`).

| Route | What it is | Status |
|---|---|---|
| `/` | Overview: the two problems, evidence links, entry points, a 23-second demo video, and "Why listen to me" | Done |
| `/fix-strip/` | Mobile Fix Strip: problem, evidence, what Flow ships, interactive phone demo, success measure | Demo done. iOS comparison waits for a device check |
| `/fix-strip/?record` | Same demo with only the phone and step panel, for screen recording | Done |
| `/thought-check/` | Thought Check: hypothesis, evidence, test workspace, results | Workspace done. Waiting on the ten recorded runs |
| `/thought-check/#results` | Results view, computed from the workspace | Done (empty until runs are entered) |
| `/thought-check/#proposal` | Proposed review interaction | Placeholder. Built after the results |

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

Deploying: any static host works with `site/` as the root (Vercel: root directory `site`, no framework).
Not deployed yet.

## Success metrics

Each feature page has a "How we'd know it worked" section: one proposed north star, four supporting
metrics, five guardrails and kill criteria, chosen with the PM-OS north-star and STEDII skills. No Wispr
baselines are available, so thresholds marked "proposed" are starting points; never-events are zero.
Thought Check's metrics apply only if the experiment finds meaning losses.

## Demo video

Built with the /brag workflow and Hyperframes 0.8.163, rendered locally. Music: Happy Beats / Business
Moves vol. 10 by ende.app (CC BY 4.0, credit optional, credited on the page). SFX: Kenney (CC0). The
video shows simulated input, labeled on screen.

## What's simulated

- **Fix Strip dictation.** "Dictate" inserts a prepared sentence. Nothing is recorded or recognized.
- **Fix Strip spoken replacement.** "Say it" fills in a prepared phrase from a fixed lookup
  (`SIMULATED_REPLACEMENTS` in `site/assets/fixstrip-core.js`: "Tuesday" → "Thursday"). Any other
  selection must be typed. It does not show how Wispr's recognition performs.
- **Fix Strip composer.** A mock-up inside the page. It is not a keyboard and doesn't touch other apps.
- **Thought Check workspace.** Nothing. Every output is pasted from the real Flow app.
- **Thought Check review interaction (not built yet).** Will use hand-prepared suggestions, labeled simulated.

## Evidence references

Review quotes are verbatim from `wispr-reviews/data/annotated_reviews.csv` (scraped 2026-10-11).
Store feeds give no per-review link, so each is identified by `review_id`. They are examples of a
problem, not estimates of how common it is. Data lives in `site/assets/evidence.js`.

| Concept | Review ID | Date | Platform | Stars | Theme |
|---|---|---|---|---|---|
| Fix Strip | `ios_14588888578` | 2026-09-24 | iOS US, app 1.76 | 4 | Correcting small mistakes |
| Fix Strip | `ios_14606766515` | 2026-09-29 | iOS US, app 1.76 | 1 | Switching between dictation and typing |
| Fix Strip | `ios_14647561822` | 2026-10-09 | iOS US, app 1.77 | 3 | Editing eats the time saved (about typing in general) |
| Thought Check | `play_992689aa-a5fc-4125-a004-b7d8c674f486` | 2026-09-09 | Android, app 2.3.1 | 4 | Meaning changed by cleanup |
| Thought Check | `play_3e4f2950-07ef-49d6-a69f-7df8cd9140d1` | 2026-08-02 | Android, app 2.1.5 | 4 | Dropped words |
| Thought Check | `play_2626242c-a13a-4678-af80-27ce1f572240` | 2026-04-23 | Android, app 1.7.1 | 3 | Words removed or rephrased |

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
- One web search summary mentioned a "Voice Edit" button on the iOS keyboard. I could not find it in
  Wispr's docs. Unverified: check on the phone.

## Thought Check: running the ten tests

1. Open `/thought-check/` in the browser you'll keep using (data is stored per browser).
2. Fill **Test conditions** once: date, device, Flow app version, language, microphone, cleanup settings.
3. For each passage: start an audio recording (Voice Memos on a second device, or screen recording with
   mic), read the script into Flow exactly, paste Flow's output into **Actual Flow output**, lock it.
   Paste a pre-cleanup transcript only if Flow shows one.
4. Mark "Read as written" or "Misread". A misread run stays; use **Add redo**.
5. Mark every meaning unit. In passage 6, Thursday kept and Tuesday dropped is correct.
6. Record unsupported additions: content Flow added that you never said.
7. After all ten, use **Add repeat (check recurrence)** on each passage that needed substantive correction.
8. Then the two brain dumps: transcribe what you said from the recording, list its meaning units, assess.
9. **Export JSON** (full workspace plus summary) and **Export CSV** (one row per meaning unit). Audio
   attachments stay in the browser and are not exported; keep the files.

Rules the results view applies:
- The main pass counts one valid run per passage. Recurrence repeats appear beside a flagged passage
  and never enter the totals.
- "Needs substantive correction" = at least one unit omitted or changed in meaning, or at least one
  unsupported addition. Unclear doesn't count but is listed.
- No pre-cleanup transcript → every discrepancy is labeled end-to-end.
- Controlled and spontaneous runs are reported separately. Results are this experiment's findings,
  not Flow's error rate.

## Files

| Path | What |
|---|---|
| `site/index.html`, `site/assets/overview.js` | Overview |
| `site/fix-strip/index.html`, `site/assets/fixstrip.js`, `fixstrip.css` | Fix Strip page and demo UI |
| `site/assets/fixstrip-core.js` | Fix Strip state machine and text replacement (tested) |
| `site/thought-check/index.html`, `site/assets/thoughtcheck.js`, `thoughtcheck.css` | Workspace and results UI |
| `site/assets/thoughtcheck-core.js` | Passages, meaning units, tallies, CSV/JSON export, import (tested) |
| `site/assets/evidence.js` | Review quotes and docs quotes |
| `site/assets/metrics.js`, `metrics-view.js` | North star, supporting and guardrail metrics for both concepts (rendered on each page) |
| `tools/metrics-md.js` | Prints the metrics as markdown (`node tools/metrics-md.js`) |
| `site/assets/video/flow-prototypes.mp4` | Demo video (23s, 1080p). Source project: `PM-OS/projects/wispr-reviews/03-outputs/brag/` |
| `site/assets/shared.js`, `styles.css` | Theme, helpers, shared tokens (Wispr palette, same as the dashboard) |
| `RECORDING-SCRIPTS.md` | Video scripts |
| `tests/` | `node --test` unit tests for both cores |

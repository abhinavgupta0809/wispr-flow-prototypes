# Recording scripts

Spoken lines are written to be read at about 150 words a minute. Screen directions are in brackets.

## Mobile Fix Strip (about 50 seconds, about 120 words spoken)

Set up: open `/fix-strip/?record` in a browser window about 1280 px wide, light theme. Press
**Reset demo** before each take. Have `/fix-strip/` open in a second tab, scrolled to review
`ios_14588888578`.

| Time | Screen | Say |
|---|---|---|
| 0:00 | Fix Strip page header (second tab) | "Flow's dictation is good enough that people praise it in the same review where they complain about fixing one word on a phone." |
| 0:08 | Scroll to the first review card | "One iPhone user asked for 'a seamless keyboard between voice-to-text and minor edits... without having to add extra steps.'" |
| 0:16 | Switch to the `?record` tab. Tap **Dictate** | "So here's a prototype. The dictation is a prepared sentence. Nothing is being recognized." |
| 0:22 | Tap **Fix a phrase**, tap "Tuesday" | "I tap Fix, and the last dictation shows up as words I can tap. I pick 'Tuesday.'" |
| 0:29 | **Replace selection**, then **Say it** | "The replacement here is simulated: 'Thursday.'" |
| 0:33 | Preview shows. Pause one beat. Tap **Apply** | "I see the change before it lands. Only that word changes. Every other character stays." |
| 0:40 | Tap **Undo** in the bar | "And it's one tap to undo." |
| 0:43 | Stay on the phone | "Success would be time to a correct, send-ready message. I haven't timed this with users yet, and other apps would need a native feasibility check." |

Leave out: any comparison with Flow's current iOS keyboard until it has been observed and recorded
on a phone (see "The iOS comparison waits for a device check" on the page). If you record it, add one
line after 0:16 stating the app version and what the fastest current path took.

## Thought Check (60 to 90 seconds): draft, finish after the results

The middle section depends on what the ten runs show. Lines in {braces} are filled in from the
results view. Don't record until Stage B is built.

| Time | Screen | Say |
|---|---|---|
| 0:00 | Thought Check header | "When Flow turns speech into a clean draft, a dropped condition still reads fluently. My hypothesis: people may not notice when an important detail disappears or changes." |
| 0:10 | Workspace, one passage card open | "Before designing anything, I tested it. I read ten scripted passages into the real Flow app on {device}, app {version}, and checked {N} meaning units: names, dates, conditions, exclusions." |
| 0:22 | Results tab | "In this small test, {X} of 10 passages needed a substantive correction. {Describe the one example: what was said, what the draft said.} When I repeated it, the problem {recurred / did not recur}." |
| 0:38 | Proposed interaction | "Here's the idea. {Walk through: Check details, the possible omission, the source passage, Restore, the draft change, Undo.} The suggestion here is prepared by hand, and in a real product it could only come from the captured audio or its transcript." |
| 1:05 | Results tab, caveat visible | "What this shows: in my runs, {finding}. What it doesn't show: how often this happens for other people, whether users would notice on their own, or that the check can be automated reliably." |

If no run has a meaningful omission or change: say so at 0:22 ("In my runs, Flow kept every
meaning unit"), and introduce the demo as an illustrative example at 0:38.

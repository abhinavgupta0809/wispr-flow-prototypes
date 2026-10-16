# Recording scripts

Four short videos, in the site's order: Voice Skills, Phrase Repair, Review Revisions, Journal Mode. One storyline
runs through them: four moments where I still reach for the keyboard while dictating. Phrase Repair has the most
customer evidence; Voice Skills is the largest hypothesis. The scripts say so. Spoken lines are written for about 150 words a
minute. Screen directions are in brackets. Press each demo's Reset button before every take.

| Video | Main demonstration | Question to validate |
|---|---|---|
| Voice Skills | The third repeated workflow prompts a suggestion; the user edits and saves /morning, then invokes it to produce a brief across Gmail, Slack and Excel. | Does a saved skill save time and run the right workflow? |
| Phrase Repair | Flow marks a phrase, the user repeats only those words, and the sentence is corrected. | Is completing the correction faster and easier? |
| Review Revisions | Exclude Sam while retaining Leo, then change a date without changing the time or guests. | Can users inspect and adjust their final decisions accurately? |
| Journal Mode | Activate the mode, capture an entry, optionally polish, and return to the captured version. | Which version would the user save, and why? |

Before any take: every dictation, “Say it again” replacement, journal entry and Polish result in these
demos is prepared text, and every Voice Skills connection and data item is fictional. Say so on camera,
as the scripts do.

## 1. Voice Skills (about 60 seconds)

Set up: `/voice-skills/`, about 1280 px wide, scrolled to the product manager demo. Press **Reset demo**
first. The run takes about nine seconds; keep talking over it.

| Time | Screen | Say |
|---|---|---|
| 0:00 | Task history, “2 of 3” | “Voice Skills is a bigger, untested idea. Everything here is simulated: the history, the connections, the emails and numbers.” |
| 0:07 | **Accept draft** on Thursday's run. The suggestion appears | “That's the third time I've built the same morning brief. Retries and cancelled runs didn't count. Flow offers to save it, and nothing is created until I accept.” |
| 0:16 | **Review suggestion**. Point at an inferred tag | “It drafted the skill from my runs: Gmail, Slack and Excel steps, in order. Anything inferred, like the destination, is marked for review.” |
| 0:24 | Answer **Everything since my previous run**, then **2 points or more**; rename to `/morning` | “It only asks what it couldn't infer: the reporting window and the threshold. I rename it slash morning.” |
| 0:32 | **Save skill**, then **Use it now** | “Saved. Now I just say it.” |
| 0:35 | “Slash morning, focus on onboarding.” then **Run /morning** | “The command is recognized as a chip, and the part that changes, onboarding, is read as an input. Nothing posts until I approve.” |
| 0:42 | Steps run | “Each source shows its own progress.” |
| 0:47 | Brief | “One customer theme, one metric change kept apart from what might explain it, and one open question.” |
| 0:54 | Edit the draft; **Post to #product-onboarding (simulated)**, then **Post again** | “I edit, then post on purpose. Running it twice never posts twice. The question to test: does this save time and run the right workflow?” |

Optional cut-ins: the misheard input (repeat “retention” only), the workbook-unavailable recovery, and
the `/prs` developer demo.

## 2. Phrase Repair (about 45 seconds)

Set up: `/phrase-repair/?record&scenario=multi`, browser about 1280 px wide, light theme. Second tab:
`/phrase-repair/` scrolled to review `ios_14588888578`. Record once on iPhone; optionally switch the
preview to Android for the last beat.

| Time | Screen | Say |
|---|---|---|
| 0:00 | Second tab, first review card | “Flow's dictation gets praised in the same reviews that complain about fixing a word on a phone. One iPhone user asked for ‘a seamless keyboard between voice-to-text and minor edits.’” |
| 0:10 | `?record` tab. Tap **Dictate** | “Here's a prepared dictation. Nothing is recognized in this prototype.” |
| 0:14 | Point at the wavy underline on “Tuesday at three” | “Flow marks a phrase it might have wrong. In this demo the mark is prepared data, not a confidence score. It covers exactly the three words that need checking.” |
| 0:22 | Tap the underline. The repair panel opens | “Tapping it opens one small panel: suggested alternatives, say it again, or type.” |
| 0:27 | **Say it again** (simulated “Thursday at two thirty”) | “I repeat just those words, not the whole sentence.” |
| 0:31 | Preview shows. Pause a beat. **Apply** | “I see the change before it lands. Only that span changes; the text check confirms it.” |
| 0:37 | **Undo** in the bar | “Undo puts it back exactly.” |
| 0:40 | Switch to **False alarm**, Dictate, tap “Priya”, **Keep as written** | “And when the mark is wrong, Keep as written changes nothing. Marks never block sending.” |
| 0:48 | Stay on the phone | “The question to test: is finishing the correction faster and easier than today's keyboards?” |

Leave out any side-by-side with Flow's current keyboards until it has been observed on a phone and
recorded (app version, OS version, date, taps and seconds).

## 3. Review Revisions (about 50 seconds)

Set up: `/review-revisions/?record&scenario=guests`, about 1280 px wide.

| Time | Screen | Say |
|---|---|---|
| 0:00 | Scenario A message | “When I change my mind mid-sentence, Flow usually gets it right. In one of my tests it didn't: I meant to keep Leo and drop Sam, and the text kept both. This scenario is rebuilt from that test; I haven't checked the recording yet.” |
| 0:12 | Click **Review revisions** | “Reviewing is optional. The cards start from what the message actually says: Leo included, Sam included.” |
| 0:18 | Click **Source** on Guests | “There's no verified source yet, so it doesn't guess earlier names.” |
| 0:22 | Sam → **Excluded**. **Preview change** | “I set Sam to Excluded. Daniel stays optional. The preview shows only that sentence changing.” |
| 0:28 | **Apply**, then **Undo** in the bar | “Apply, and undo if I need to.” |
| 0:32 | Switch to **B · Linked revisions**. **Review revisions**, **View revisions** on Date | “This one changed three things while speaking. The message names the group instead of saying ‘the smaller group.’” |
| 0:40 | **Use Friday**, **Preview change**, **Apply** | “Bringing back Friday changes only the day. The time and the guests stay.” |
| 0:45 | Stay on the message | “The question to test: compared with just dictating another correction, can people inspect and fix their final choices more accurately, with less effort?” |

Scenario C (choose Thursday, then confirm as a separate step) is on the page for anyone who wants to
try it; it's left out of the video to keep it short.

## 4. Journal Mode (about 45 seconds)

Set up: `/journal-mode/?record`, about 1280 px wide.

| Time | Screen | Say |
|---|---|---|
| 0:00 | The empty window, mode chip reads “Normal mode” | “Journal Mode is for thinking out loud. Capture your thoughts in your own words, and clean them up when you're ready.” |
| 0:07 | Click the on-screen **fn** three times quickly | “A triple-press of fn turns it on. That shortcut is a proposal, and Flow already uses a third tap to cancel hands-free, so it needs Wispr's input. There's a button too.” |
| 0:16 | Point at the two chips | “The mode and the microphone are shown separately, so you always know which mode you're in and whether it's listening.” |
| 0:21 | **Start recording**, then **Stop** | “The entry is prepared text. Two lines come from my own journal test. It keeps the ‘today, sorry, yesterday,’ the ‘best damn burgers,’ and a word it couldn't make out stays marked.” |
| 0:31 | Point at the notice | “After the recording, Flow goes back to normal capture and says so.” |
| 0:34 | **Polish**. Compare view appears | “Polish makes a second version. The capture stays.” |
| 0:38 | Click **Captured** in the switcher, then **Keep this version** | “Here's the question to test: which version would you keep, and why? In my test, Flow mostly kept my voice already, so this is about choice.” |

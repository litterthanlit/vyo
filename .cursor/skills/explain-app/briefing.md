# What changed (the briefing workflow)

The default mode of explain-app. The person built their app with AI and does not read the code. They ask what changed, or what is in the app, and you answer in plain English with receipts.

The answer comes from a tool, not from you. `tools/scan.mjs changes` scans the app now, scans an earlier version, compares the two scans and prints the briefing. The same two versions always give the same words. **Do not read the diff and write your own summary.** Relay what the tool prints.

Commands run from the skill folder. `<repo>` is the app's folder as an absolute path (its git top level, if it uses git). `<canvases>` is the output folder from the host notes in [SKILL.md](SKILL.md): Cursor's canvases folder, or `~/.explain-app/<repo>/` in Claude Code. `changes` refuses to write anywhere inside `<repo>`, so keep every file it makes in `<canvases>`.

```bash
node tools/scan.mjs changes <repo> --since <X>
```

## 1. Turn their words into `--since`

| They say | `--since` | Note |
|---|---|---|
| "What did the agent just do?", "what did you change?", "before I commit", "what's different from my last save?" | `HEAD` | Compares with the last saved version (the last commit) and **includes work not saved yet**. This is the answer to "what did the agent just change" |
| "Since yesterday", "this morning", "since Tuesday", "last week", "since the 5th" | an ISO date such as `2026-10-11` | Work the date out with `date`; never guess it. A bare date means 00:00 that day, so "yesterday" compares with the last saved version from before yesterday began |
| "Catch me up", "since last time", "since we last looked" | the bookmark file `<canvases>/<repo>-bookmark.json` | See step 6. Check the file exists first: a path that is not a file is read as a version name, and the command stops. If there is no bookmark yet, say so, use `empty`, and leave one |
| "What's in my app?", "everything", "what do I have?" | `empty` | Prints "Where your app stands now" instead of a comparison |
| A named version: a tag, a branch or a commit id | that name | Used as it is |
| Two facts files they saved earlier | `diff <before.json> <after.json>` | No git needed. `scan` makes a facts file |

- A version or a date needs git history. If the folder is not a git project, or has no saved versions (commits) yet, the command stops with a message that says so. Tell them in one plain sentence what is missing, then use the bookmark or `empty`. `empty` and a facts file need no git.
- A shallow clone (only recent history was downloaded): `HEAD` and any version the clone holds still work. A date stops, because the tool cannot tell which saved version a date falls after, and so does a version that was not downloaded. The message says `git fetch --unshallow` fetches the rest.
- Give it a sub-folder of the project with a date or version and the command stops and prints the top-level folder. Run it again with that folder. (`empty` and a facts file work on any folder.)
- A date before the project's first saved version: everything counts as new. The title becomes "Where your app stands now" and the line under it says when the first saved version is. Say it plainly.
- Dates it accepts: an ISO date (`2026-10-11`); an ISO date with a time (`2026-10-11T09:30`); a number and a unit, then `ago` (`3 days ago`; units are second, minute, hour, day, week, month, year); and `now`, `today`, `yesterday` (24 hours ago), `midnight` (the start of today), `noon`. Anything else, such as `last week` or `10/11/2026`, stops with "it doesn't look like a date", so turn it into an ISO date yourself. Git would otherwise read other text, such as a `HEAD~50` that goes past the first saved version, as "now".

## 2. Run it

| Flag | What it does | When |
|---|---|---|
| `--receipts` | Adds a `↳` line under each item: the files behind it | Only when they ask "where?", "show me" or "which file?" |
| `--html <file>` | Also writes the briefing as one offline web page (no scripts; light and dark; prints well). The text still prints | When they want something to look at later or to send. Save it in `<canvases>` |
| `--canvas <canvas.tsx>` | Reads the canvas's `PARTS` and adds poster lines to "Worth a look": "Your poster is out of date…", "… isn't on your poster yet" | When they have a page 3 canvas |
| `--json` | Prints the raw Changes ([CONTRACTS.md §7](tools/CONTRACTS.md)) instead of the text | For you to check a line that looks wrong. Never to retype numbers |
| `--out <changes.json>` | Also saves the raw Changes. The text still prints | Rarely |
| `--save-facts <file>` | Saves a scan of the files as they are right now, as a bookmark | The first run of a briefing: step 6 |

- Flags come after `<repo>`, as `--flag value` or `--flag=value`. `--since` is required.
- The briefing (or, with `--json`, the Changes) is all that goes to stdout. Progress (`Reading your last saved version…`), warnings (lines starting `! `) and `→ <file>` confirmations go to stderr. Relay stdout as it is.
- Exit codes: **0** it worked, whether or not anything changed. **1** it could not do what was asked; read the `✗` line (not a git project, a sub-folder, a version or date it cannot find, a file it cannot read, an output path inside `<repo>`). **2** the command itself was wrong: no `<repo>` or no `--since`, an unknown flag, a flag without its value, or a `--since` that starts with `-`. `-h` prints the usage and exits 0.
- Two facts files they saved earlier go to `diff <before.json> <after.json>`. It takes the same output flags (`--receipts`, `--html`, `--canvas`, `--json`, `--out`), but not `--since` or `--save-facts`. Its line under the title is "Comparing two scans of …". It has no repo to protect, so it writes `--html` and `--out` wherever you point them: keep them in `<canvases>`.

## 3. Relay it

- Paste what the tool printed, in the same order and with the same headings. A code block keeps the numbers lined up.
- Say at most **one sentence** before it, to orient them. For `HEAD`: "Here is what changed since your last saved version, including edits you have not saved yet."
- **Never recompute, round or retype a count.** Do not add your own tally ("that is 5 changes"). If they ask how many, read it off the numbers.
- Do not add things the tool did not print, not from the code and not from `git diff`. If a line looks wrong, run `--json`. If it still looks wrong, say the scan may have misread it. Do not patch the briefing.
- Keep the last line: what the scan cannot see. If the tool only says "Nothing changed.", add that sentence yourself.
- Write in the builder's voice. See [Briefing voice](plain-language-rules.md#briefing-voice-what-changed). Never call a line "dead code" or say something "does not work".

## 4. "Where?" and "show me"

Run the same command again with `--receipts`, and without `--save-facts`. Give them only the lines they asked about, with their `↳` lines. File paths are fine now because they asked. If the first run used the bookmark as `--since`, compare with the copy you kept (step 6), because that run moved the bookmark.

## 5. Something to look at or send

Run it with `--html <canvases>/<repo>-what-changed.html` and give them the path. It is one file that opens offline in any browser and reads well on a phone. The page has the same sections as the text, with the two scans' hashes at the foot. Add `--receipts` only if they want the files in it: each line then gets a "Show me where" fold. If you already ran the briefing, run it again with `--html`, without `--save-facts`.

## 6. Leave a bookmark

A bookmark is a saved scan of the app as it is now: what the person has just been told about. "Catch me up" next time compares with it. People who never save versions (commit) have nothing else to compare with.

Add `--save-facts <canvases>/<repo>-bookmark.json` to the **first** run of a briefing, the one they read, and make that run before you edit anything. The same run writes the bookmark and prints the briefing. It works with any `--since`:

```bash
node tools/scan.mjs changes <repo> --since HEAD --save-facts <canvases>/<repo>-bookmark.json
```

- **No bookmark yet?** `--since empty --save-facts …` prints "Where your app stands now" and leaves the first one.
- **`--since` is the bookmark itself?** One run compares with the old bookmark and then replaces it with the new scan. Run it again straight away and it says "Nothing changed." So keep a copy first, for "where?" and `--html`, and use the copy as `--since` for those:

  ```bash
  cp <canvases>/<repo>-bookmark.json <canvases>/<repo>-bookmark-was.json
  node tools/scan.mjs changes <repo> --since <canvases>/<repo>-bookmark.json --save-facts <canvases>/<repo>-bookmark.json
  ```
- **Only the first run.** Leave `--save-facts` off the follow-ups (`--receipts`, `--html`). The files may have changed since, and the bookmark would skip those edits.
- The file lives in `<canvases>` and is named `<repo>-bookmark.json`, not `<repo>-facts.json`: page 3's checker reads that file and treats a changed one as stale.

## 7. Read "Worth a look" for them

These are the lines to slow down on. Say what it means and offer one next step. Do not take action unasked.

| The line says | It means | Offer |
|---|---|---|
| "X (saved data) was removed. Anything stored in it may be lost" (or "was renamed Y") | A saved record is gone from the app's design. The scan sees how the app is designed, not what is stored. Whether real data goes depends on how the database is updated when they publish | Ask if they meant it. If it is live, check before publishing. Offer to bring it back from the saved version |
| "The X screen was removed. Anything that links to it will break." | A page is gone | Ask if they meant it; offer to find what links to it |
| "The X request can no longer …" or "was removed" | Something your screens or other apps ask for stopped answering | Same |
| "X is new. It needs an account and keys, and it may cost money." | A new outside service | Ask if they have an account and keys for it |
| "X is new. Each time your app uses it, it may cost money." (X is an AI provider, such as Anthropic) | A new AI provider | Ask about the key and the monthly limit |
| "X now goes through B instead of A. You will need an account and keys for B." | A service was swapped | Ask if the swap was on purpose |
| "The X job is new. It will run on its own once you publish this." | Something will run without anyone clicking | Say when it runs (the New section's line for the job has the schedule) |
| "X lost N% of its code" | A whole part of the app got much smaller | Ask if that was on purpose |
| "The scan finds no screens, saved records … in your app now." | The app looks empty. Wrong folder, or most of it was deleted | Check the folder first |
| Only "Nothing changed." after `--since empty` | The folder has nothing the scan recognises, so there is nothing to compare. Almost always the wrong folder | Check the folder first |
| Lines about different names, few matching files, changes that "do not match any edit", or many things with one name | The comparison may not be fair | Say so and offer to check |

"Now connected" means a screen now leads to an outside service, AI provider, saved record or request that no screen led to before. "Not on a screen yet" means the code has it but no screen seems to lead to it ("… is in the code, but no screen seems to lead to it yet", or "No screen seems to lead to X any more" when one used to). That is **not** the same as broken. The scan follows imports and requests up to three steps from a screen or a background job. Wiring done higher up, such as a sign-in provider wrapped around the whole app, is invisible to it. Say "it may be hooked up in a way I can't see" and offer to check.

## 8. When to suggest saving a version first

Offer, in one line. Never save a version (commit) unasked.

- `HEAD` shows a lot of unsaved change, especially with a line in Worth a look: "This is a good moment to save a version, so you have something to go back to."
- They say it looks right: "Want me to save a version of this?" Then `HEAD` stays a small, useful comparison next time.
- The project has no saved versions yet: say a first one makes "what changed" work from now on. Until then use bookmarks.

## 9. What the scan cannot see

Be honest about these. Never say "no changes users would notice".

- **Wording, colour, images and settings.** A screen can look completely different and show no change if its size and links stay the same. Keys and environment settings are invisible too.
- **"Heavily reworked" is a size test.** The code behind a screen, request or job changed by at least 20 lines and a quarter of its size. A rewrite of the same size is invisible. A big paste-in looks like a rework.
- **Moves are matched only when the match is certain.** Otherwise a thing is listed as gone and another as new. A saved record is never matched by the file it sits in.
- **Three steps.** "Now used from the Plan screen" and "no screen seems to lead to it" only look three steps from a screen or a job.
- **Generated code.** When screens reach requests through a generated client, the briefing cannot say which screen uses which request, and says so once.
- **Data.** "Removed" is about how the app is built, not about what is in the database.
- **Very large projects** (about 19,000 files or more) are read in part. The size numbers can be too low and the briefing says so.

## 10. Then offer posters

If something notable changed, or they already have posters, add one line at the end: "I can redraw your poster so it matches." Offer page 1, or the page they have. Do not start Explain mode unasked. With `--canvas` the briefing already says if a poster is out of date.

## Examples

**"What did the agent just do? I didn't read any of it."** Their repo is `~/code/pantry`.

```bash
node tools/scan.mjs changes ~/code/pantry --since HEAD --save-facts ~/.explain-app/pantry/pantry-bookmark.json
```

Say one sentence and paste the output. The bookmark is already saved.

**"Catch me up on yesterday."** Today is 2026-10-12, so yesterday is 2026-10-11.

```bash
node tools/scan.mjs changes ~/code/pantry --since 2026-10-11 --save-facts ~/.explain-app/pantry/pantry-bookmark.json
```

Then offer `--html` if they want something to send.

**"Catch me up."** They have a bookmark from last time. Keep a copy, then compare and move it forward in one run:

```bash
cp ~/.explain-app/pantry/pantry-bookmark.json ~/.explain-app/pantry/pantry-bookmark-was.json
node tools/scan.mjs changes ~/code/pantry --since ~/.explain-app/pantry/pantry-bookmark.json --save-facts ~/.explain-app/pantry/pantry-bookmark.json
```

### The line under the title

The title and the line under it say what was compared. Relay them as printed.

| `--since` | Title | Line under it |
|---|---|---|
| `HEAD`, or a date or version that lands on the latest saved version | What changed | Since your last saved version (a1b2c3d, 2026-10-07) · compared with your files right now. |
| An older version, branch or tag, or a date that lands on one | What changed | Since your saved version (a1b2c3d, 2026-10-07) · compared with your files right now. |
| A facts file, such as a bookmark | What changed | Since your earlier scan (pantry-bookmark.json) · compared with your files right now. |
| `empty` | Where your app stands now | This is everything the scan found in your files right now. |
| A date before the first saved version | Where your app stands now | This is everything the scan found in your files right now. Your first saved version is from 2026-10-07, after the date you asked about, so everything counts as new. |
| `diff` on two facts files | What changed | Comparing two scans of Pantry. |

The date in brackets is the day of that saved version, not the day you asked about. When nothing changed at all, the line under the title is followed by just "Nothing changed.", with no numbers or sections.

A short sample of what comes back for `HEAD`. [examples.md](examples.md) has the whole briefing, and a test keeps both in step with the tool.

<!-- briefing-excerpt:BEGIN -->
```text
What changed

Since your last saved version (a1b2c3d, 2026-10-07) · compared with your files right now.

1 new screen, 1 new outside service, the AI is now used from the Plan screen, 1 saved record was removed, and 2 other changes.

Screens           6 → 7 (+1)
Saved records     4 → 3 (−1)
…
Now connected
- OpenAI is now used from the Plan screen.

Worth a look
- Ingredient (saved data) was removed. Anything stored in it may be lost if you publish this.
- Text messages (Twilio) is new. It needs an account and keys, and it may cost money.
…
```
<!-- briefing-excerpt:END -->

# What changed (the briefing workflow)

The default mode of explain-app. The person built their app with AI and does not read the code. They ask what changed, or what is in the app, and you answer in plain English with receipts.

The answer comes from a tool, not from you. `tools/scan.mjs changes` scans the app now, scans an earlier version, compares the two scans and prints the briefing. The same two versions always give the same words. **Do not read the diff and write your own summary.** Relay what the tool prints.

Commands run from the skill folder. `<repo>` is the app's folder as an absolute path (its git top level, if it uses git). `<canvases>` is the output folder from the host notes in [SKILL.md](SKILL.md): Cursor's canvases folder, or `~/.explain-app/<repo>/` in Claude Code. Nothing the tools write goes inside `<repo>`; they refuse it.

```bash
node tools/scan.mjs changes <repo> --since <X>
```

## 1. Turn their words into `--since`

| They say | `--since` | Note |
|---|---|---|
| "What did the agent just do?", "what did you change?", "before I commit", "what's different from my last save?" | `HEAD` | Compares with the last saved version (the last commit) and **includes work not saved yet**. This is the answer to "what did the agent just change" |
| "Since yesterday", "this morning", "since Tuesday", "last week", "since the 5th" | an ISO date such as `2026-10-11` | Work the date out with `date`; never guess it. A bare date means 00:00 that day, so "yesterday" compares with the last saved version from before yesterday began |
| "Catch me up", "since last time", "since we last looked" | the bookmark file `<canvases>/<repo>-bookmark.json` | See step 6. If there is no bookmark yet, say so, use `empty`, and leave one |
| "What's in my app?", "everything", "what do I have?" | `empty` | Prints "Where your app stands now" instead of a comparison |
| A named version: a tag, a branch or a commit id | that name | Used as it is |
| Two facts files they saved earlier | `diff <before.json> <after.json>` | No git needed. `scan` makes a facts file |

- A date or a version needs git history. Not a git repo, no commits yet, or a shallow clone: the command stops with a message. Tell them in one plain sentence what is missing, then use the bookmark or `empty`.
- Give it a sub-folder of the project with a date or version and the command stops and prints the top-level folder. Run it again with that folder.
- A date before the project's first saved version: everything counts as new, and the first line says so. Say it plainly.

## 2. Run it

| Flag | What it does | When |
|---|---|---|
| `--receipts` | Adds a `↳` line under each item: the files behind it | Only when they ask "where?", "show me" or "which file?" |
| `--html <file>` | Writes the briefing as one offline web page (no scripts; light and dark; prints well) | When they want something to look at later or to send. Save it in `<canvases>` |
| `--canvas <canvas.tsx>` | Adds poster lines: "Your poster is out of date", "isn't on your poster yet" | When they have a page 3 canvas |
| `--json` | Prints the raw Changes ([CONTRACTS.md §7](tools/CONTRACTS.md)) | For you to check a line that looks wrong. Never to retype numbers |
| `--out <changes.json>` | Saves the raw Changes | Rarely |
| `--save-facts <file>` | Saves the current scan as a bookmark | Step 6 |

Exit codes: 0 means it worked, whether or not anything changed. 1 means an error (read the `✗` line). 2 means a usage mistake. <!-- verify: exit codes and flag names against lib/changes-cli.mjs -->

## 3. Relay it

- Paste what the tool printed, in the same order and with the same headings. A code block keeps the numbers lined up.
- Say at most **one sentence** before it, to orient them. For `HEAD`: "Here is what changed since your last saved version, including edits you have not saved yet."
- **Never recompute, round or retype a count.** Do not add your own tally ("that is 5 changes"). If they ask how many, read it off the numbers.
- Do not add things the tool did not print, not from the code and not from `git diff`. If a line looks wrong, run `--json`. If it still looks wrong, say the scan may have misread it. Do not patch the briefing.
- Keep the last line: what the scan cannot see. If the tool only says "Nothing changed.", add that sentence yourself.
- Write in the builder's voice. See [Briefing voice](plain-language-rules.md#briefing-voice-what-changed). Never call a line "dead code" or say something "does not work".

## 4. "Where?" and "show me"

Run the same command again with `--receipts`. Give them only the lines they asked about, with their `↳` lines. File paths are fine now because they asked.

## 5. Something to look at or send

Run it with `--html <canvases>/<repo>-what-changed.html` and give them the path. It is one file that opens offline in any browser and reads well on a phone. Add `--receipts` only if they want the files in it.

## 6. Leave a bookmark

A bookmark is a saved scan of the app as it is now. "Catch me up" next time compares with it. People who never save versions (commit) have nothing else to compare with.

After you have relayed the briefing, and before you edit anything, run:

```bash
node tools/scan.mjs changes <repo> --since empty --save-facts <canvases>/<repo>-bookmark.json
```

Ignore the text it prints. Only the file matters. <!-- verify: --save-facts with --since empty writes the live scan and ignores the old bookmark; if --save-facts also works on the briefing run itself, fold it into step 2 -->

Keep the bookmark in `<canvases>`, not under the name `<repo>-facts.json`: page 3's checker reads that file and treats a changed one as stale.

## 7. Read "Worth a look" for them

These are the lines to slow down on. Say what it means and offer one next step. Do not take action unasked.

| The line says | It means | Offer |
|---|---|---|
| "X (saved data) was removed. Anything stored in it may be lost" (or "was renamed Y") | A saved record is gone from the app's design. The scan sees how the app is designed, not what is stored. Whether real data goes depends on how the database is updated when they publish | Ask if they meant it. If it is live, check before publishing. Offer to bring it back from the saved version |
| "The X screen was removed. Anything that links to it will break." | A page is gone | Ask if they meant it; offer to find what links to it |
| "The X request can no longer …" or "was removed" | Something your screens or other apps ask for stopped answering | Same |
| "X is new. It needs an account and keys, and it may cost money." | A new outside service | Ask if they have an account and keys for it |
| "AI X is new. Each time your app uses it, it may cost money." | A new AI provider | Ask about the key and the monthly limit |
| "X now goes through B instead of A. You will need an account and keys for B." | A service was swapped | Ask if the swap was on purpose |
| "The X job is new. It will run on its own once you publish this." | Something will run without anyone clicking | Say when it runs (the New section's line for the job has the schedule) |
| "X lost N% of its code" | A whole part of the app got much smaller | Ask if that was on purpose |
| "The scan finds no screens, saved records … in your app now." | The app looks empty. Wrong folder, or most of it was deleted | Check the folder first |
| Lines about different names, few matching files, changes that "do not match any edit", or many things with one name | The comparison may not be fair | Say so and offer to check |

"Now connected" means a screen now leads to an outside service, AI provider, saved record or request that no screen led to before. "Not on a screen yet" means the code has it but no screen seems to lead to it. That is **not** the same as broken. The scan follows imports and requests up to three steps from a screen or a background job. Wiring done higher up, such as a sign-in provider wrapped around the whole app, is invisible to it. Say "it may be hooked up in a way I can't see" and offer to check.

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
node tools/scan.mjs changes ~/code/pantry --since HEAD
```

Say one sentence, paste the output, then run step 6.

**"Catch me up on yesterday."** Today is 2026-10-12, so yesterday is 2026-10-11.

```bash
node tools/scan.mjs changes ~/code/pantry --since 2026-10-11
```

Then offer `--html` if they want something to send.

A short sample of what comes back. [examples.md](examples.md) has the whole briefing, and a test keeps both in step with the tool. <!-- verify: the first line's wording for each --since form -->

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

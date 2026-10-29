# Vyo launch film (draft)

A 28-second, 16:9 launch film for Vyo, made with [Continuity](https://github.com/litterthanlit/continuity). `vyo-launch.mp4` is a smaller re-encode of the 1080p render, without audio.

| # | Scene | What it says |
|---|-------|--------------|
| 1 | hook | "Code says how. Not what it's for." Real file paths sit beside the line. |
| 2 | translate | Each file next to what it lets a person do. "Plan your week" keeps its ink. |
| 3 | build | The poster builds itself. Each step Vyo types changes it: read fills it with code, shape carves the spotlight out of the code, words land in the cone, key keeps "Plan your week" bright. |
| 4 | shape | The real Spotlight and Hourglass posters: "A shape that fits." |
| 5 | end | The portrait: code types across the frame leaving "Vyo" as holes, the holes fill with plain words, the orange full stop lands, then "Point it at a repo. Get the poster." |

The final cut passes `ct check --deep` with 0 errors and 0 warnings, and render QC is clean. `report.md`, `critique.md`, `contact-sheet.png` and `motion-energy.png` are Continuity's own outputs.

## Known gaps

- **House type.** The film's type is Continuity's house look, litt (Geist, warm dark). Continuity only loads its own fonts, so the posters' Commit Mono and Newsreader appear only inside the poster images. Vyo's orange is the accent (`project/theme.ts`).
- **The Vyo window's steps are illustrative.** They describe what the skill does; there is no CLI that prints them.
- **Self-scored.** I scored the critique myself with Continuity's rubric. No separate critic agent reviewed it.
- **No install claim.** Vyo has no public install command yet, so the end card doesn't name one.

## Re-render

From a Continuity checkout (`pnpm install`, then `npx ct doctor`):

```bash
cp -r <this folder>/project projects/vyo-launch
npx ct check vyo-launch --deep
npx ct render vyo-launch          # → out/vyo-launch/latest.mp4
```

# Vyo launch film (draft)

A 26-second, 16:9 launch film for Vyo, made with [Continuity](https://github.com/litterthanlit/continuity). `vyo-launch.mp4` is a smaller re-encode of the 1080p render, without audio.

| # | Scene | What it says |
|---|-------|--------------|
| 1 | hook | "Code says how. Not what it's for." Real file paths sit beside the line. |
| 2 | scan | "It reads every file first." A terminal lists what the scan found in the recipe planner. |
| 3 | translate | Each file next to what it lets a person do. "Plan your week" keeps its ink. |
| 4 | draw | The Spotlight poster drawing itself: plain words land in a cone, the code stays outside. |
| 5 | shape | The real Spotlight and Hourglass posters: "A shape that fits." |
| 6 | end | "Vyo." with the orange dot, then "Point it at a repo. Get the poster." |

The final cut passes `ct check --deep` with 0 errors and 0 warnings, and render QC is clean. `report.md`, `critique.md`, `contact-sheet.png` and `motion-energy.png` are Continuity's own outputs.

## Known gaps

- **House type.** The film's type is Continuity's house look, litt (Geist, warm dark). Continuity only loads its own fonts, so the posters' Commit Mono and Newsreader appear only inside the poster images. Vyo's orange is the accent (`project/theme.ts`).
- **End card.** The motion chart flags its final 2.4s as still. That is the tagline's required read time; shortening the scene fails the read-time check.
- **Self-scored.** I scored the critique myself with Continuity's rubric. No separate critic agent reviewed it.
- **The typed prompt is illustrative.** Vyo has no public install command yet, so the end card makes no install claim.

## Re-render

From a Continuity checkout (`pnpm install`, then `npx ct doctor`):

```bash
cp -r <this folder>/project projects/vyo-launch
npx ct check vyo-launch --deep
npx ct render vyo-launch          # → out/vyo-launch/latest.mp4
```

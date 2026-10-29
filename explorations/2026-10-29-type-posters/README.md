# Type-led posters (mockups)

The direction the brainstorm landed on: Vyo makes a poster that explains what a product does, and the words build the picture. Vyo picks a shape that acts out the product's main moment and fills it with the product's own words. One colour marks the word that matters. These are hand-tuned mockups, not output of the skill.

| File | Shape | Why it fits |
|------|-------|-------------|
| `png/hourglass.png`, `png/hourglass-dark.png` | Hourglass | Hypher squeezes a messy dump into one note and hands it to the next agent. Only "decisions" is orange, so they visibly survive the squeeze. |
| `png/ribbon-dark.png` | Twisting ribbon | Save in Claude Code, resume in Codex. The ribbon is made of what travels between them. |
| `png/warm-start.png` | Square-dot letters | "Your next agent knows", warming line by line from cold grey to orange. |
| `png/vyo-eye.png` | Eye | Vyo itself: it reads everything in a repo (the lids) and sees what the product is for (the iris). |

References that shaped it: *Durations* (Public Records), *Constellation of Complicity* (BACC, 2025) and *Type Cube Experimental*.

## Type and colour

- **Commit Mono** for the words that make the shape. It's free (OFL) and isn't the JetBrains Mono that every ASCII poster uses.
- **Newsreader** for the one serif line.
- **Logos:** Helvetica Neue where it's installed, else **Inter Display** Bold. Helvetica Neue is a paid font, so the skill would bundle Inter Display.
- **Dark themes:** tinted deep navy or deep violet, not plain black.
- **Avoided:** the defaults that read as AI-made, such as 01/02/03 markers, middle-dot meta strings and made-up codes.

## Regenerate

```bash
./fetch-fonts.sh                     # Commit Mono and Newsreader into ./fonts (not committed)
node render.mjs hourglass.html hourglass-dark.html ribbon-dark.html warm-start.html vyo-eye.html
```

Needs Node and Playwright with Chromium. The ribbon's headlines and the logo fallback use Inter Display from the system.

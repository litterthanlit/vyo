# Studio OS poster (mockup)

A type-led poster in the same style as `../2026-10-29-type-posters`. Studio OS isn't in this repo, so the copy assumes it is one app that runs a creative studio: briefs, feedback, files, hours and invoices in one place.

The shape is a vortex of rings made of real words. The outer rings hold what a studio juggles (client emails, Slack threads, Figma links, "final_final_v3"). They are grey, broken and drifting. Further in, the rings close and start at the same angle, so the studio's loop (brief, concept, design, review, approve, ship, invoice) lines up into columns. The innermost ring, "the work", is the only orange one.

## Regenerate

```bash
./fetch-fonts.sh
node render.mjs studio-os.html   # writes studio-os.png
```

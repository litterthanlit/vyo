# litt.design work posters

A landscape poster (16:10) for every project on litt.design: Hypher, Wavr, Studio OS, Vyo and litt.md. All copy comes from the project's case study page. Each picture is made of the project's own words and acts out what the project does:

| Poster | Picture |
|--------|---------|
| Hypher | A sideways hourglass. The mess you dump in narrows to one note, and the next agent reads it on the other side |
| Wavr | A moving mesh gradient drawn in shader uniform names. Pointing at it bends the field |
| Studio OS | Scattered references, compiled into taste directives (protect, send, avoid), shipped as a screen on a 12-column grid |
| Vyo | A real repo's files (the skill's test fixture) are read, run through scan, wire and check, and come out as a poster |
| litt.md | The average of the internet, struck out, against a score of 100 set in design tokens |

`posters.html` is live: every picture moves and reacts to the pointer, holds still for reduced motion, and has a Hold still button.

## Regenerate

```bash
./fetch-fonts.sh
node build.mjs   # dist/posters.html (fonts inlined) and png/*.png
```

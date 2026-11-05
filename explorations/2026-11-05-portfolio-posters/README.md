# litt.design work posters

A landscape poster (16:10) for every project on litt.design: Hypher, Wavr, Studio OS, Vyo and litt.md. All copy comes from the project's case study page. Each picture is made of the project's own words and acts out what the project does:

| Poster | Picture |
|--------|---------|
| Hypher | Every line of the mess pinches into one tight orange knot, the note, then loosens into the next agent. Pointing loosens the knot |
| Wavr | A moving mesh gradient drawn in shader uniform names. Pointing bends the field |
| Studio OS | Reference words fall from chaos on the left into a strict 12-column layout on the right. Pointing applies taste |
| Vyo | A field of Vyo's own scanner source; the glyphs that land on an App Guide poster turn solid. Pointing peels it back to code |
| litt.md | A field of style declarations. Off-brand values glow purple until the lint sweeps past and the score climbs. Pointing lints |

`posters.html` is live: every picture moves and reacts to the pointer, holds still for reduced motion, and has a Hold still button.

## Regenerate

```bash
./fetch-fonts.sh
node build.mjs   # dist/posters.html (fonts inlined) and png/*.png
```

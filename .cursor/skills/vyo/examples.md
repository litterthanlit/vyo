# Examples

## Sample prompts

**Client handoff**
> Explain this app to my client as a poster. They need to understand what we built without any code.

**PM overview**
> Walk me through how this product works for a PM. One page, and be honest about what's live.

**Selling**
> Help me talk about my product. Make me a poster I can send to people.

**A picture in mind**
> Draw my codebase as an hourglass: everything my users throw at it, squeezed into one plan.

## Choosing the field for three products

Write the product's story in one sentence. If it moves something from one place to another, take wave. If it is about which parts carry the product, take terrain. If many things merge into one, take river. If one object a stranger would name stands for the product, take shape and draw it. Then run `vyo parts` with that field and put the accent on the part the story is about.

| Product | Story | Field | Accent part | Plain names |
|---|---|---|---|---|
| Pantry, a meal planner | Your recipes go in, one week of dinners comes out, and the list goes to the shop | wave | `area:lib/plan`, the part that builds the week | Two parts scan as "Plan". Call `area:components/plan` "week view" and `area:lib/plan` "the plan" |
| Tally, a review inbox for small shops | Of all the parts, the one that picks today's review is the product | terrain | the part that ranks reviews | A scanned name like `RANKER2` is flagged. Call it "today's pick" |
| Hypher, project memory for coding agents | Saves from many agent sessions merge into one project note that the next agent reads | river | `area:hypher-web/convex`, where saves land and merge into the note | `parts --field river` flags it as "Convex", a vendor. Call it "server". Three parts scan as "Main app", so give each its own name. "Oauth" is not flagged but reads as code, so call it "sign-in" |

Tally is made up. Pantry is the `recipe` test fixture. Hypher's parts come from `explorations/2026-11-07-abstract-fields/hypher-facts.json`, and a river splits them finer than a wave or a terrain does, so its ids differ.

## The fields, as full specs for Pantry

Pantry is the `recipe` test fixture. It has 6 screens (recipes, a recipe, a new recipe, the weekly plan, settings, home), recipes with ingredients, a weekly plan, a shopping list, AI suggestions, and a weekly email every Monday at 8. It has payment code but no checkout screen, so the chat reply lists "paid plans" as not built.

Each block below is the preset file in the package's `tools/presets/`. `compose --field <id>` writes the same shape with placeholders and its own text positions. The `facts` value is a placeholder: yours is the hash from your own scan, and `compose` writes it. The commit is made up, since the fixture is not a git repo. Each spec names every part, not only the flagged ones, because the scanned names repeat ("Plan", "Recipes", "Main app").

The legend names the accent part as the poster colours it. On a light wave the accent rows are black. On dark, and on a terrain or river, they are orange.

### wave

Pantry's story is a flow: recipes go in, the week's plan forms, the list goes to the shop. The wave carries that flow down the page, and the accent on `area:lib/plan` marks the rows where the plan is built.

The legend names "the plan" and the measure "code". The fits sentence passes with "moves" and "travels".

```json
{
  "version": 3,
  "frame": "loose",
  "facts": "000000000000",
  "product": {
    "name": "Pantry",
    "repo": "recipe",
    "commit": "04186f4",
    "date": "2026-11-07"
  },
  "theme": "light",
  "headline": "A week of dinners, planned in one go.",
  "figure": {
    "regions": [
      {
        "kind": "field",
        "id": "wave",
        "field": "wave",
        "fits": "Pantry's story is a week that moves from saved recipes to dinners, so a band of its code travels down the page.",
        "accent": "area:lib/plan",
        "names": {
          "area:.": "saved recipes",
          "area:app": "page frame",
          "area:app/(app)": "screens",
          "area:app/api": "requests",
          "area:components": "screen pieces",
          "area:components/plan": "week view",
          "area:components/recipes": "recipe cards",
          "area:components/ui": "buttons",
          "area:lib": "accounts and email",
          "area:lib/ai": "suggestions",
          "area:lib/plan": "the plan",
          "area:lib/recipes": "recipe book"
        },
        "sentence": "dinner, decided"
      }
    ],
    "texts": [
      {
        "role": "label",
        "id": "label",
        "x": 580,
        "y": 40,
        "w": 220,
        "align": "right"
      },
      {
        "role": "headline",
        "id": "headline",
        "x": 40,
        "y": 905,
        "w": 264,
        "align": "left"
      },
      {
        "role": "legend",
        "id": "legend",
        "x": 40,
        "y": 797,
        "w": 260,
        "align": "left",
        "text": "Every row is a part of Pantry, as many rows as it has code. The black rows are the plan."
      },
      {
        "role": "list",
        "id": "list",
        "x": 560,
        "y": 80,
        "w": 240,
        "align": "right",
        "parts": true
      }
    ]
  }
}
```
### terrain

Read as a range, Pantry shows that its screens are the biggest part and that the plan is a small peak that carries the product.

The legend names "the plan" and both measures, "code" and "files". The fits sentence passes with "matters" and "most".

```json
{
  "version": 3,
  "frame": "loose",
  "facts": "000000000000",
  "product": {
    "name": "Pantry",
    "repo": "recipe",
    "commit": "04186f4",
    "date": "2026-11-07"
  },
  "theme": "dark",
  "headline": "A week of dinners, planned in one go.",
  "figure": {
    "regions": [
      {
        "kind": "field",
        "id": "terrain",
        "field": "terrain",
        "fits": "What matters most in Pantry is the plan, so each part stands as a peak as big as its code.",
        "accent": "area:lib/plan",
        "names": {
          "area:.": "saved recipes",
          "area:app": "page frame",
          "area:app/(app)": "screens",
          "area:app/api": "requests",
          "area:components": "screen pieces",
          "area:components/plan": "week view",
          "area:components/recipes": "recipe cards",
          "area:components/ui": "buttons",
          "area:lib": "accounts and email",
          "area:lib/ai": "suggestions",
          "area:lib/plan": "the plan",
          "area:lib/recipes": "recipe book"
        }
      }
    ],
    "texts": [
      {
        "role": "label",
        "id": "label",
        "x": 40,
        "y": 40,
        "w": 220,
        "align": "left"
      },
      {
        "role": "headline",
        "id": "headline",
        "x": 40,
        "y": 80,
        "w": 364,
        "align": "left"
      },
      {
        "role": "legend",
        "id": "legend",
        "x": 40,
        "y": 239,
        "w": 260,
        "align": "left",
        "text": "Every peak is a part of Pantry, as tall as its code and as wide as its files. The orange peak is the plan."
      },
      {
        "role": "list",
        "id": "list",
        "x": 560,
        "y": 40,
        "w": 240,
        "align": "right",
        "parts": true
      }
    ]
  }
}
```
### river

Pantry takes many saved recipes and makes one week from them. Every part enters as a stream, and the plan is the stream lit in orange.

The legend names "the plan" and the measure "merge". The fits sentence passes with "merges", "many", "joins" and "one". A river prints no part names, so a paragraph says what the product does.

```json
{
  "version": 3,
  "frame": "loose",
  "facts": "000000000000",
  "product": {
    "name": "Pantry",
    "repo": "recipe",
    "commit": "04186f4",
    "date": "2026-11-07"
  },
  "theme": "dark",
  "headline": "A week of dinners, planned in one go.",
  "figure": {
    "regions": [
      {
        "kind": "field",
        "id": "river",
        "field": "river",
        "fits": "Pantry merges many saved recipes into one week, so every part of its code joins one river.",
        "accent": "area:lib/plan",
        "names": {
          "area:.": "saved recipes",
          "area:app": "page frame",
          "area:app/(app)": "screens",
          "area:app/api": "requests",
          "area:components": "screen pieces",
          "area:components/plan": "week view",
          "area:components/recipes": "recipe cards",
          "area:components/ui": "buttons",
          "area:lib": "accounts and email",
          "area:lib/ai": "suggestions",
          "area:lib/plan": "the plan",
          "area:lib/recipes": "recipe book"
        }
      }
    ],
    "texts": [
      {
        "role": "label",
        "id": "label",
        "x": 40,
        "y": 40,
        "w": 220,
        "align": "left"
      },
      {
        "role": "headline",
        "id": "headline",
        "x": 40,
        "y": 995,
        "w": 364,
        "align": "left"
      },
      {
        "role": "legend",
        "id": "legend",
        "x": 540,
        "y": 1046,
        "w": 260,
        "align": "right",
        "text": "Each stream is a part of Pantry, as thick as its code; streams merge where they use each other. The orange stream is the plan."
      },
      {
        "role": "paragraph",
        "id": "paragraph",
        "x": 560,
        "y": 40,
        "w": 240,
        "align": "right",
        "text": "Save the recipes you already cook. Pantry fills the week from them and builds the shopping list."
      }
    ]
  }
}
```
### shape

Pantry keeps a week of recipes the way a jar keeps preserves, so the poster draws one jar and fills it with Pantry's code. The lid and the shoulders make it a jar at thumbnail size: a rounded lid, a narrow neck, and a body with 24-unit corners, three ops in a 100 by 130 box. It is turned 9 degrees, so the top corners hold the words, and it bleeds off the bottom. The bands run from the lid down in tree order, each as much of the jar as its code. The more code, the bigger the type, so "screens" and "recipe cards" are set huge and "buttons" is texture. The orange band is the plan.

Before rendering, `vyo sketch` printed the jar's bands, its 62% of the sheet and its corners, and wrote `recipe-sketch.png`. It printed no `!` line.

```json
{
  "version": 3,
  "frame": "loose",
  "facts": "000000000000",
  "product": {
    "name": "Pantry",
    "repo": "recipe",
    "commit": "04186f4",
    "date": "2026-11-07"
  },
  "theme": "light",
  "headline": "A week of dinners, planned in one go.",
  "figure": {
    "regions": [
      {
        "kind": "field",
        "id": "shape",
        "field": "shape",
        "fits": "Pantry keeps a week of recipes the way a jar keeps preserves, so the picture is a jar of its code.",
        "accent": "area:lib/plan",
        "names": {
          "area:.": "saved recipes",
          "area:app": "page frame",
          "area:app/(app)": "screens",
          "area:app/api": "requests",
          "area:components": "screen pieces",
          "area:components/plan": "week view",
          "area:components/recipes": "recipe cards",
          "area:components/ui": "buttons",
          "area:lib": "accounts and email",
          "area:lib/ai": "suggestions",
          "area:lib/plan": "the plan",
          "area:lib/recipes": "recipe book"
        },
        "shape": {
          "rotate": 9,
          "fit": { "h": 0.9, "cx": 0.52, "cy": 0.64 },
          "ops": [
            { "add": "rect", "at": [16, 0], "size": [68, 16], "round": 3 },
            { "add": "rect", "at": [22, 15], "size": [56, 9] },
            { "add": "rect", "at": [4, 22], "size": [92, 108], "round": 24 }
          ]
        }
      }
    ],
    "texts": [
      { "role": "label", "id": "label", "x": 40, "y": 40, "w": 220, "align": "left" },
      { "role": "headline", "id": "headline", "x": 40, "y": 72, "w": 420, "align": "left" },
      {
        "role": "legend",
        "id": "legend",
        "x": 540,
        "y": 40,
        "w": 260,
        "align": "right",
        "text": "Every band is a part of Pantry, its type as big as its share of the code. The orange band is the plan."
      }
    ]
  }
}
```

### shape in rings

The same jar, set in rings. Pantry's jar is fat and round, so its outline has room for rings: the lid floats 3 units above the neck and gets rings of its own, and a cut in the body makes the label, a hole the legend sits in. `"style": "rings"` runs the parts' names round the outline, ring inside ring, in tree order from the outline in, each part as much of the jar's area as its code. Where the rings would fold, past the shoulders, they stop, and the cores in the lid and above and below the label are set in level lines on a tone of their own. The plan is a solid orange band with its name reversed out. `"echo": 4` draws four faded outlines around the jar. The legend names the measure as "area".

Before rendering, `vyo sketch` printed 22 rings of 7px for 12 parts, one line per part with its rings and its share of the area beside its share of the lines, and no `!` line.

```json
{
  "version": 3,
  "frame": "loose",
  "facts": "000000000000",
  "product": {
    "name": "Pantry",
    "repo": "recipe",
    "commit": "04186f4",
    "date": "2026-11-07"
  },
  "theme": "dark",
  "headline": "A week of dinners, planned in one go.",
  "figure": {
    "regions": [
      {
        "kind": "field",
        "id": "shape",
        "field": "shape",
        "style": "rings",
        "fits": "Pantry keeps a week of recipes the way a jar keeps preserves, so the picture is a jar of its code.",
        "accent": "area:lib/plan",
        "names": {
          "area:.": "saved recipes",
          "area:app": "page frame",
          "area:app/(app)": "screens",
          "area:app/api": "requests",
          "area:components": "screen pieces",
          "area:components/plan": "week view",
          "area:components/recipes": "recipe cards",
          "area:components/ui": "buttons",
          "area:lib": "accounts and email",
          "area:lib/ai": "suggestions",
          "area:lib/plan": "the plan",
          "area:lib/recipes": "recipe book"
        },
        "shape": {
          "fit": {
            "h": 0.74,
            "cy": 0.6
          },
          "ops": [
            {
              "add": "rect",
              "at": [
                22,
                0
              ],
              "size": [
                56,
                13
              ],
              "round": 4
            },
            {
              "add": "rect",
              "at": [
                28,
                16
              ],
              "size": [
                44,
                10
              ]
            },
            {
              "add": "rect",
              "at": [
                6,
                22
              ],
              "size": [
                88,
                108
              ],
              "round": 26
            },
            {
              "cut": "rect",
              "at": [
                22,
                62
              ],
              "size": [
                56,
                30
              ],
              "round": 4
            }
          ]
        },
        "echo": 4
      }
    ],
    "texts": [
      {
        "role": "label",
        "id": "label",
        "x": 40,
        "y": 40,
        "w": 220,
        "align": "left"
      },
      {
        "role": "headline",
        "id": "headline",
        "x": 40,
        "y": 72,
        "w": 420,
        "align": "left"
      },
      {
        "role": "legend",
        "id": "legend",
        "x": 300,
        "y": 790,
        "w": 240,
        "align": "center",
        "text": "Every ring is a part of Pantry, its area as big as its share of the code. The orange rings are the plan."
      }
    ]
  }
}
```

## Sample chat reply

```markdown
Pantry plans a week of dinners from the recipes you already cook, then turns the plan into a shopping list and emails it every Monday.

I drew Pantry as a wave with the plan as the accent, because "Pantry's story is a week that moves from saved recipes to dinners, so a band of its code travels down the page."

The legend reads: "Every row is a part of Pantry, as many rows as it has code. The black rows are the plan."

- PNG: /Users/<you>/code/pantry/vyo/recipe-poster.png
- PDF: /Users/<you>/code/pantry/vyo/recipe-poster.pdf

Gaps: the code has payments, but there is no checkout screen, so paid plans are not built yet. Add `vyo/` to `.gitignore` unless you want to commit the poster.
```

## Swiss frame

Use it when the owner asks for a masthead and footer, or the repo has no git history. `compose --field wave --frame swiss` writes this shape. The aside does the legend's job, and the footer holds the notes, the not-built list and the counts line that render writes from the scan. Never type the counts:

```
6 screens, 3 kinds of request, 4 kinds of saved record, 3 outside services (email, payments, sign-in), 1 AI model, runs 1 job on its own
```

### wave-swiss

```json
{
  "version": 3,
  "frame": "swiss",
  "facts": "000000000000",
  "product": {
    "name": "Pantry",
    "repo": "recipe",
    "date": "2026-11-07"
  },
  "theme": "light",
  "headline": "A week of dinners, planned in one go.",
  "figure": {
    "regions": [
      {
        "kind": "field",
        "id": "wave",
        "field": "wave",
        "fits": "Pantry's story is a week that moves from saved recipes to dinners, so a band of its code travels down the page.",
        "accent": "area:lib/plan",
        "names": {
          "area:.": "saved recipes",
          "area:app": "page frame",
          "area:app/(app)": "screens",
          "area:app/api": "requests",
          "area:components": "screen pieces",
          "area:components/plan": "week view",
          "area:components/recipes": "recipe cards",
          "area:components/ui": "buttons",
          "area:lib": "accounts and email",
          "area:lib/ai": "suggestions",
          "area:lib/plan": "the plan",
          "area:lib/recipes": "recipe book"
        },
        "sentence": "dinner, decided"
      }
    ],
    "texts": [
      {
        "role": "masthead",
        "id": "masthead",
        "x": 50,
        "y": 36,
        "w": 490
      },
      {
        "role": "headline",
        "id": "headline",
        "x": 56,
        "y": 150,
        "w": 420
      },
      {
        "role": "aside",
        "id": "aside",
        "x": 56,
        "y": 764,
        "w": 240,
        "text": "Every row is a part of Pantry, as many rows as it has code. The black rows build the week's plan."
      }
    ]
  },
  "notes": [
    {
      "title": "How it works",
      "text": "Save the recipes you already cook. Pantry fills the week from them, suggests a few new ones, and builds the shopping list from what the plan needs."
    },
    {
      "title": "Every Monday",
      "text": "At 8 in the morning Pantry emails you the week's plan, so the first dinner is decided before the day starts."
    },
    {
      "title": "Yours alone",
      "text": "Sign in with your own account. Your recipes, plans and lists are saved to it, and you can pick up the week on any device."
    }
  ],
  "notBuilt": [
    "paid plans"
  ]
}
```

## Drawing your own silhouette

When the owner asks for a picture and the scan has code, draw it as a shape field instead, like the jar above: the field cuts your silhouette into the parts. Use this path when the scan is empty, or the owner wants the swiss frame. The table under "Find the shape" helps with either. You invent one silhouette that acts out the product's main moment and describe it as fill regions and texts. Fill figures sit in the swiss frame, with its masthead and footer. Start from `compose --from <preset>`, then sketch, render and check as for a field.

### Find the shape

Start from the verb in the main moment, not the category.

| When the product... | Try |
|---|---|
| squeezes many things into one | hourglass |
| carries something from one place to another | ribbon |
| reads everything, then focuses on one thing | eye |
| warms up, or turns unknown into known | dot letters, cold to hot |
| grows, or takes you up in stages | tree or stair |
| joins two sides | bridge or knot |
| guards or keeps safe | shield or wall |
| repeats on a cycle | ring |

Bend it to the product. A ring can break open where today's item leaves.

Make one strong silhouette:

- Draw one dominant silhouette, not separate blocks. Two blocks side by side read as two columns, whatever their tops do.
- Its outline is a continuous curve across the whole band. The profile's half-widths change at most stops, not only at the ends.
- Negative space goes inside the shape as holes, not as gaps between blocks, like the eye's empty pupil.
- Aim for about a third of the band covered.
- A region narrower than about 160px reads as a column. `thin-region` warns under 160px on average. `row-variety` fails a region whose line widths spread less than 0.25 of their mean.
- A hot region cycles its words down every row, so give it two or three short phrases, not a list.
- The thumbnail test: shrink it in your head to a stamp and name it in one word. That word must describe what the product does.

None of these acts out a moment. Never use:

- a heart, for anything about people or care
- a plain circle, which passes every check, or a box filled edge to edge
- a blob with no edge a person could name
- "01, 02, 03" step markers

The words:

- Every word is a noun the product's user would say: "leftovers", "busy nights", "the shopping list". Never a feature name, a role word or a code name. Product and tool names the user actually uses today (Claude Code, Codex, Cursor) are allowed; they are not jargon.
- Each region has one job and its own words: what goes in, what comes out, what travels.
- One hot word on the whole poster, where the moment happens: the waist, the iris, the last line.
- Tones give depth. `soft` is far or past, `ink` is near or now. Two or three tones step down a region, each row taking the nearest stop. `cold` and `cool` are blue-greys for a state not yet warm.

### Describe the regions

The sheet is 840 by 1190 px and y grows downward. A figure has `fits` (at most 160 characters), 1 to 6 `regions` and 1 to 6 `texts`.

A fill region has `kind: "fill"`, `id`, one geometry, `words` (2 to 14, at most 24 characters each) and `tone`. Options: `holes` (shapes to cut out), `band` (1 to 4 rows per word), `size` (11 or 12), `caps`, and `hot` (every row in the accent). Geometry, by preference: `profile`, 3 to 24 stops `[y, cx, halfWidth]` with y increasing; `ellipse` `{ cx, cy, rx, ry }`; `polygon`, 3 to 40 `[x, y]` points for hard corners; `path`, an SVG path.

A dots region spells 2 to 4 words of at most 5 letters in squares: `kind: "dots"`, `id`, `lines`, `x`, `y`, `cell` (px per square), and `tones`, one per line, which may include `hot`. A dots line is 29 squares wide and 7 tall, with lines 9 squares apart.

A text has `role` (`masthead`, `headline`, `display`, `aside` or `label`), `id`, `x`, `y`, `w`, and optional `size`, `align` (`left`, `right` or `center`) and `hot`. Asides, displays and labels need `text`. One masthead prints the product name, shrunk to fit `w`. At most one headline prints `spec.headline`. A `display` is a bold sans line of at most 40 characters A label with `hot: true` is set in the accent, uppercase and tracked. Default sizes: masthead 84 (48 to 120), headline 22 (18 to 40), display 56 (32 to 64), aside 12 (10 to 14), label 12 (10 to 32), hot label 26. No region or text may use the ids `note`, `counts`, `notBuilt`, `provenance` or `credit`.

Rows are 16px tall, 14px at size 11, on a sheet-wide grid. The tool skips any part of a row within 12px of a text and drops runs under 24px. A fill region needs 4 rows or more.

Six worked profiles for a band from y 180 to 860. Each passed `silhouette` and `row-variety` as one region. Move or stretch them, and keep holes inside the outline.

| Shape | `profile` | Hole |
|---|---|---|
| flame | `[[180,450,4],[300,400,80],[440,450,180],[620,410,270],[770,420,260],[860,420,130]]` | |
| bottle | `[[180,420,50],[300,420,50],[380,420,110],[460,420,260],[800,420,270],[860,420,230]]` | |
| bridge arch | `[[200,420,40],[300,420,200],[460,420,340],[640,420,390],[860,420,400]]` | profile `[[500,420,30],[580,420,180],[700,420,260],[860,420,290]]` |
| leaf | `[[180,560,4],[300,500,160],[480,440,260],[660,380,230],[800,330,110],[860,310,6]]` | |
| key | `[[180,420,150],[240,420,260],[340,420,260],[420,420,140],[470,420,60],[700,420,60],[740,480,120],[860,480,120]]` | ellipse `cx 420, cy 300, rx 110, ry 60` |
| wave | `[[180,330,90],[260,270,190],[340,330,230],[460,430,250],[640,430,330],[860,420,390]]` | ellipse `cx 230, cy 380, rx 70, ry 60` |

A figure with no fill region (dots only) skips `row-variety`, `thin-region` and `one-region`.

### Fill the spec

`compose` fills `version`, `facts`, `product`, `theme` (`light` or `dark`) and a placeholder `figure`, which render rejects.

| Field | What it is |
|---|---|
| `product.name` | The customer-facing name. `product-name` warns while it is the folder name |
| `accent` | Optional hot colour, a hex |
| `headline` | One plain sentence about the outcome, at most 72 characters |
| `hot` | The one word or two-word phrase that matters, drawn in the figure |
| `notes` | 2 or 3 footer columns. `title` at most 24 characters, `text` at most 220 |
| `notBuilt` | 0 to 6 plain items (at most 32 characters each) the code has but a user cannot use yet |

Each note does a job the picture cannot: how it works, what you get, what stays private, what runs on its own, or proof. Never type a count, a commit or a date into the footer; render writes those. Follow [plain-language-rules.md](plain-language-rules.md). The presets and the invented figures below are worked specs.

### From the main moment to the picture

Write the main moment as one sentence. Find its verb. The verb gives the shape.

| App | Main moment | Verb | Picture |
|---|---|---|---|
| Pantry, a meal planner | Turns your recipes, leftovers and cravings into one week of dinners | squeezes | An hourglass. What you juggle pours through one week's plan into a shopping list |
| Relay, a handoff board for shift teams | The night shift's notes are waiting when the day shift arrives | carries | A ribbon made of what travels, from one shift to the other |
| Tally, a review inbox for small shops | Reads every review and flags the one to answer today | reads, then focuses | An eye. The lids are every review, the iris is the one that matters |
| A habit app | A streak that warms up day by day | warms up | Dot letters that go from cold blue-grey to the accent |

### The fill presets, as full specs for Pantry

Pantry is the same fixture as above. `npx vyo presets` lists these four beside wave, terrain, river and wave-swiss. `compose --from <id>` copies one with its words replaced by placeholders. A poster that keeps a preset's geometry unchanged gets the `preset-copy` warning, so use them to learn from or to bend, not to ship as they are.

Each block below is the preset file in the package's `tools/presets/`, with the same words and geometry. Only the layout of the number lists is tighter.

#### hourglass

Two profile regions meet at a narrow waist, 30px each side of x 420 where `inputs` ends at y 512 and `outputs` starts at y 576. The top holds what you juggle and steps from soft to mid. The bottom holds what comes out, in ink. The hot label sits in the gap, `align: "center"` in a wide box, and at size 26 by default.

```json
{
  "version": 3,
  "frame": "swiss",
  "facts": "000000000000",
  "product": { "name": "Pantry", "repo": "recipe", "date": "2026-11-07" },
  "theme": "light",
  "headline": "A week of dinners, planned in one go.",
  "hot": "leftovers",
  "figure": {
    "fits": "An hourglass: everything you juggle pours in at the top, narrows to one week's plan at the waist, and comes out as a list and an email.",
    "regions": [
      {
        "kind": "fill",
        "id": "inputs",
        "profile": [
          [176, 420, 365],
          [189, 420, 365],
          [253, 420, 297],
          [317, 420, 231.2],
          [381, 420, 168.3],
          [445, 420, 109.1],
          [493, 420, 68.4],
          [509, 420, 55.9],
          [512, 420, 30]
        ],
        "words": [
          "recipes",
          "cravings",
          "leftovers",
          "busy nights",
          "allergies",
          "what's in season",
          "the budget",
          "family picks"
        ],
        "tone": ["soft", "mid"]
      },
      {
        "kind": "fill",
        "id": "outputs",
        "profile": [
          [576, 420, 30],
          [579, 420, 70.2],
          [595, 420, 84],
          [659, 420, 143.8],
          [723, 420, 208.4],
          [787, 420, 276.4],
          [867, 420, 365],
          [880, 420, 365]
        ],
        "words": ["shopping list", "tonight's dinner", "Monday's email", "next week"],
        "tone": "ink"
      }
    ],
    "texts": [
      { "role": "masthead", "id": "masthead", "x": 50, "y": 36, "w": 490 },
      { "role": "headline", "id": "headline", "x": 560, "y": 64, "w": 224 },
      {
        "role": "label",
        "id": "waist",
        "text": "ONE WEEK",
        "hot": true,
        "x": 220,
        "y": 526,
        "w": 400,
        "align": "center"
      },
      {
        "role": "aside",
        "id": "juggle",
        "text": "What you juggle. Recipes, cravings, leftovers, allergies, busy nights.",
        "x": 56,
        "y": 522,
        "w": 190
      },
      {
        "role": "aside",
        "id": "plan",
        "text": "**One plan a week:** seven dinners from your own recipes, with the leftovers used up first.",
        "x": 594,
        "y": 528,
        "w": 190
      },
      {
        "role": "aside",
        "id": "out",
        "text": "What comes out. A shopping list, and the plan in your inbox every Monday.",
        "x": 56,
        "y": 650,
        "w": 190
      }
    ]
  },
  "notes": [
    {
      "title": "How it works",
      "text": "Save the recipes you already cook. Pantry fills the week from them, suggests a few new ones, and builds the shopping list from what the plan needs."
    },
    {
      "title": "Every Monday",
      "text": "At 8 in the morning Pantry emails you the week's plan, so the first dinner is decided before the day starts."
    },
    {
      "title": "Yours alone",
      "text": "Sign in with your own account. Your recipes, plans and lists are saved to it, and you can pick up the week on any device."
    }
  ],
  "notBuilt": ["paid plans"]
}
```

#### ribbon

Three profile regions make one ribbon that runs from top left to bottom right. Each ends on the pinch where the next begins. The middle region is the back face of the twist, set soft so the ribbon reads as turning over. `band: 3` keeps each word for three rows, so the words read as stripes along the ribbon. The two ends are `display` texts, bold sans lines of the poster's own words: "Plan it in the kitchen." at the top and "Shop it in the aisle." at the bottom right, with `align: "right"`.

```json
{
  "version": 3,
  "frame": "swiss",
  "facts": "000000000000",
  "product": { "name": "Pantry", "repo": "recipe", "date": "2026-11-07" },
  "theme": "dark",
  "accent": "#9284FF",
  "headline": "The week you plan at home is the list in your hand.",
  "hot": "shopping list",
  "figure": {
    "fits": "A ribbon that twists from the kitchen at the top to the aisle at the bottom, made of what travels between them: dinners, the list, amounts.",
    "regions": [
      {
        "kind": "fill",
        "id": "kitchen",
        "profile": [
          [196, 228.6, 184.7],
          [210, 234.1, 183.2],
          [224, 241.1, 174.6],
          [238, 249.3, 159.5],
          [252, 258.5, 138.4],
          [266, 268.7, 112.4],
          [280, 279.6, 82.8],
          [294, 291, 50.9],
          [308, 302.9, 51.8]
        ],
        "words": ["seven dinners", "amounts"],
        "tone": "mid",
        "size": 11,
        "band": 3
      },
      {
        "kind": "fill",
        "id": "turn",
        "profile": [
          [308, 302.9, 51.8],
          [322, 315.1, 83.7],
          [336, 327.4, 113.2],
          [350, 339.9, 139.1],
          [364, 352.4, 160],
          [378, 364.9, 175],
          [392, 377.3, 183.3],
          [406, 389.7, 184.6],
          [420, 402, 178.9],
          [434, 414.3, 166.3],
          [448, 426.5, 147.5],
          [462, 438.7, 123.3],
          [476, 451, 95],
          [490, 463.2, 63.8],
          [504, 475.6, 38.7]
        ],
        "words": ["shopping list", "what's left over", "who's eating"],
        "tone": "soft",
        "size": 11,
        "band": 3
      },
      {
        "kind": "fill",
        "id": "aisle",
        "profile": [
          [504, 475.6, 38.7],
          [518.5, 488.5, 72.3],
          [533.1, 501.4, 104],
          [547.6, 514.4, 132.1],
          [562.1, 527.4, 155.3],
          [576.7, 540.2, 172.4],
          [591.2, 553, 182.4],
          [605.7, 565.4, 184.9],
          [620.3, 577.4, 179.7],
          [634.8, 588.9, 167.2],
          [649.3, 599.6, 147.9],
          [663.9, 609.4, 122.8],
          [678.4, 618, 93.3],
          [692.9, 625.4, 60.7],
          [707.5, 631.2, 43.1],
          [722, 635.4, 76.5]
        ],
        "words": ["swaps", "shopping list", "seven dinners", "amounts"],
        "tone": "mid",
        "size": 11,
        "band": 3
      }
    ],
    "texts": [
      {
        "role": "display",
        "id": "start",
        "text": "Plan it in the kitchen.",
        "x": 56,
        "y": 56,
        "w": 470
      },
      {
        "role": "aside",
        "id": "travels",
        "text": "**What travels.** Seven dinners, the shopping list with amounts, and what's left over from last week.",
        "x": 560,
        "y": 64,
        "w": 224
      },
      { "role": "masthead", "id": "masthead", "x": 56, "y": 740, "w": 330, "size": 48 },
      { "role": "headline", "id": "headline", "x": 56, "y": 804, "w": 330 },
      {
        "role": "display",
        "id": "end",
        "text": "Shop it in the aisle.",
        "x": 384,
        "y": 764,
        "w": 400,
        "align": "right"
      }
    ]
  },
  "notes": [
    {
      "title": "How it works",
      "text": "Pick your recipes for the week. Pantry adds up the ingredients and turns them into one shopping list you can read in the shop."
    },
    {
      "title": "Every Monday",
      "text": "At 8 in the morning Pantry emails you the week's plan and the list, so nothing is left on the kitchen table."
    },
    {
      "title": "Yours alone",
      "text": "Sign in with your own account. Your recipes, plans and lists are saved to it, and you can open them on any device."
    }
  ],
  "notBuilt": ["paid plans"]
}
```

#### eye

The lids are a profile with a hole, and their tone steps soft, mid, soft down the rows. The iris is an ellipse with its own hole and `hot: true`, so every iris row is in the accent. The masthead is centred at size 72 in the hole, and the fill clears it, which leaves the pupil empty.

```json
{
  "version": 3,
  "frame": "swiss",
  "facts": "000000000000",
  "product": { "name": "Pantry", "repo": "recipe", "date": "2026-11-07" },
  "theme": "light",
  "headline": "It knows what you cook, then suggests what to cook next.",
  "hot": "new ideas",
  "figure": {
    "fits": "An eye: the lids are everything Pantry reads about your kitchen, the iris is the few ideas it sees, and the name sits in the pupil.",
    "regions": [
      {
        "kind": "fill",
        "id": "lids",
        "profile": [
          [320, 420, 0],
          [360, 420, 98.7],
          [400, 420, 182.2],
          [440, 420, 250.5],
          [480, 420, 303.7],
          [520, 420, 341.6],
          [560, 420, 364.4],
          [600, 420, 372],
          [640, 420, 364.4],
          [680, 420, 341.6],
          [720, 420, 303.7],
          [760, 420, 250.5],
          [800, 420, 182.2],
          [840, 420, 98.7],
          [880, 420, 0]
        ],
        "holes": [
          { "ellipse": { "cx": 420, "cy": 600, "rx": 240, "ry": 240 } }
        ],
        "words": [
          "your recipes",
          "last week",
          "leftovers",
          "allergies",
          "the season",
          "busy nights",
          "the budget",
          "favourites"
        ],
        "tone": ["soft", "mid", "soft"],
        "size": 11
      },
      {
        "kind": "fill",
        "id": "iris",
        "ellipse": { "cx": 420, "cy": 600, "rx": 222, "ry": 222 },
        "holes": [
          { "ellipse": { "cx": 420, "cy": 600, "rx": 114, "ry": 114 } }
        ],
        "words": ["tonight's dinner", "new ideas", "the list"],
        "tone": "ink",
        "size": 11,
        "hot": true
      }
    ],
    "texts": [
      { "role": "headline", "id": "headline", "x": 56, "y": 52, "w": 520, "size": 40 },
      {
        "role": "aside",
        "id": "blurb",
        "text": "Pantry looks at what you cook, what's left and who's eating, then suggests the few new recipes worth trying this week.",
        "x": 600,
        "y": 60,
        "w": 184
      },
      {
        "role": "masthead",
        "id": "masthead",
        "x": 290,
        "y": 562,
        "w": 260,
        "size": 72,
        "align": "center"
      }
    ]
  },
  "notes": [
    {
      "title": "What it reads",
      "text": "Your saved recipes and their ingredients, last week's plan, and what you told it about allergies and busy nights."
    },
    {
      "title": "What it suggests",
      "text": "A few new recipes that fit the week, from an AI model. You choose which ones to keep."
    },
    {
      "title": "What it sends",
      "text": "The week's plan by email every Monday at 8, and a shopping list built from the plan."
    }
  ],
  "notBuilt": ["paid plans"]
}
```

#### warm-start

One dots region spells four words in squares. Its `tones` run cold, cool, ink, hot, and the last line also equals the spec's `hot`, so it is set in the accent. There are no fill regions, so `row-variety` and `one-region` are skipped. With 2 notes the footer is shorter and the floor is 920.

```json
{
  "version": 3,
  "frame": "swiss",
  "facts": "000000000000",
  "product": { "name": "Pantry", "repo": "recipe", "date": "2026-11-07" },
  "theme": "light",
  "headline": "Every week starts with a question. Pantry answers it on Monday.",
  "hot": "well",
  "figure": {
    "fits": "Four words drawn in squares that warm up line by line, cold blue to the accent, the way a blank week fills up by Monday.",
    "regions": [
      {
        "kind": "dots",
        "id": "words",
        "lines": ["PLAN", "ONCE", "EAT", "WELL"],
        "x": 130,
        "y": 56,
        "cell": 20,
        "tones": ["cold", "cool", "ink", "hot"]
      }
    ],
    "texts": [
      { "role": "headline", "id": "headline", "x": 56, "y": 772, "w": 400, "size": 34 },
      { "role": "masthead", "id": "masthead", "x": 496, "y": 766, "w": 288, "size": 48 },
      {
        "role": "aside",
        "id": "monday",
        "text": "**Monday at 8:** the week's plan lands in your inbox, so the first dinner is already decided.",
        "x": 496,
        "y": 830,
        "w": 288
      }
    ]
  },
  "notes": [
    {
      "title": "How",
      "text": "Save the recipes you already cook. Pantry fills the week from them, uses up the leftovers first, and builds the shopping list."
    },
    {
      "title": "New ideas",
      "text": "Ask for a suggestion and Pantry offers a few recipes that fit your week. Keep the ones you like and they join your recipes."
    }
  ],
  "notBuilt": ["paid plans"]
}
```

### Three invented pictures

None of these is a preset. Each starts from a main moment, finds its verb, and builds one silhouette a person would name at thumbnail size. The products are made up. Each block below is the `figure` only. Each passes every check with three notes and a short not-built list, but the numbers are a first draft to sketch from.

#### A bridge for a sync tool

Tandem keeps the files on your phone and your laptop the same. Main moment: the photo you take on your phone is on your laptop when you sit down. The verb is "joins", so the picture is one bridge arch, its left foot on the phone's side and its right foot on the laptop's. The whole arch is made of what crosses, soft at the crown and ink at the feet. The opening under it is a hole, so the water stays empty paper inside the shape. Two separate towers with a deck between them would read as two columns, so the arch is one region with one outline.

```json
{
  "fits": "One bridge arch from your phone to your laptop, made of what crosses it.",
  "regions": [
    { "kind": "fill", "id": "arch", "tone": ["soft", "mid", "ink"],
      "words": ["photos", "voice notes", "the latest version", "screenshots", "receipts", "drafts"],
      "profile": [[200, 420, 40], [300, 420, 200], [460, 420, 340], [640, 420, 390], [860, 420, 400]],
      "holes": [{ "profile": [[500, 420, 30], [580, 420, 180], [700, 420, 260], [860, 420, 290]] }] }
  ],
  "texts": [
    { "role": "masthead", "id": "name", "x": 56, "y": 40, "w": 420 },
    { "role": "headline", "id": "headline", "x": 560, "y": 64, "w": 224 },
    { "role": "aside", "id": "left", "text": "From your phone.", "x": 196, "y": 790, "w": 150 },
    { "role": "aside", "id": "right", "text": "To your laptop.", "x": 494, "y": 790, "w": 150, "align": "right" }
  ]
}
```

`hot` is "latest version". It matches a word in the arch.

#### A stair for a learning app

Rungs teaches a language ten minutes a day, and each lesson opens the next. Main moment: every lesson you finish is one step up, and the top step is your first real conversation. The verb is "climbs", so the picture is a stair rising from left to right. One polygon draws the lower steps with the early lessons. Its two tones split it: soft in the upper rows and ink in the lower, because the lessons you have done are near and solid. Above the top step, a speech bubble is its own region with `hot: true`, so the goal is the one bright thing on the page. A plain box on top would read as a column.

```json
{
  "fits": "A stair of lessons, one step each, up to your first real conversation at the top.",
  "regions": [
    { "kind": "fill", "id": "steps", "tone": ["soft", "ink"],
      "words": ["greetings", "numbers", "the café", "directions", "small talk"],
      "polygon": [[80, 860], [80, 760], [200, 760], [200, 660], [320, 660], [320, 560], [440, 560], [440, 460], [760, 460], [760, 860]] },
    { "kind": "fill", "id": "bubble", "tone": "ink", "hot": true,
      "words": ["first conversation", "your own words"],
      "ellipse": { "cx": 640, "cy": 350, "rx": 140, "ry": 80 } }
  ],
  "texts": [
    { "role": "masthead", "id": "name", "x": 56, "y": 40, "w": 420 },
    { "role": "headline", "id": "headline", "x": 56, "y": 150, "w": 400, "size": 30 },
    { "role": "aside", "id": "daily", "text": "**Ten minutes a day.** Finish a lesson and the next step opens.", "x": 80, "y": 520, "w": 200 }
  ]
}
```

`hot` is "first conversation". The steps change width on every step, and the bubble is round, so each region passes `row-variety`.

#### A shield for a backup tool

Nightly copies a small office's files every night. Main moment: whatever the office made today is safe by morning. The verb is "guards", so the picture is a shield. A profile draws the outline, wide at the top and narrowing to a point. A smaller profile inside it is cut out as a hole and drawn again as its own region in the accent. That gives the shield a rim of what it guards and an emblem of the copy that keeps it.

```json
{
  "fits": "A shield made of the office's files, with last night's copy as its emblem.",
  "regions": [
    { "kind": "fill", "id": "rim", "tone": ["mid", "ink"],
      "words": ["invoices", "contracts", "photos", "the client list", "spreadsheets", "email"],
      "profile": [[200, 420, 250], [240, 420, 272], [420, 420, 262], [600, 420, 210], [740, 420, 120], [856, 420, 12]],
      "holes": [{ "profile": [[288, 420, 170], [420, 420, 170], [560, 420, 128], [680, 420, 52]] }] },
    { "kind": "fill", "id": "emblem", "tone": "ink", "hot": true,
      "words": ["last night", "every file", "today's work"],
      "profile": [[304, 420, 150], [420, 420, 150], [552, 420, 110], [660, 420, 36]] }
  ],
  "texts": [
    { "role": "masthead", "id": "name", "x": 56, "y": 40, "w": 420 },
    { "role": "headline", "id": "headline", "x": 560, "y": 64, "w": 224 },
    { "role": "aside", "id": "when", "text": "**Every night at 2.** Nothing to remember, nothing to plug in.", "x": 594, "y": 720, "w": 190 }
  ]
}
```

`hot` is "last night". The emblem region has `hot: true`, so all its rows are in the accent.

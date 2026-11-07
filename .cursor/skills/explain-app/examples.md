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

## From the main moment to the picture

Write the main moment as one sentence. Find its verb. The verb gives the shape.

| App | Main moment | Verb | Picture |
|---|---|---|---|
| Pantry, a meal planner | Turns your recipes, leftovers and cravings into one week of dinners | squeezes | An hourglass. What you juggle pours through one week's plan into a shopping list |
| Hypher, a handoff note for coding agents | Save in Claude Code, resume in Codex | carries | A ribbon made of what travels, from one tool to the other |
| Tally, a review inbox for small shops | Reads every review and flags the one to answer today | reads, then focuses | An eye. The lids are every review, the iris is the one that matters |
| A habit app | A streak that warms up day by day | warms up | Dot letters that go from cold blue-grey to the accent |

## The presets, as full specs for Pantry

Pantry is the `recipe` test fixture. It has 6 screens (recipes, a recipe, a new recipe, the weekly plan, settings, home), recipes with ingredients, a weekly plan, a shopping list, AI suggestions, and a weekly email every Monday at 8. It has payment code but no checkout screen, so every spec puts "paid plans" in `notBuilt`.

`node tools/vyo.mjs presets` lists these four. `compose --from <id>` copies one with its words replaced by placeholders. A poster that keeps a preset's geometry unchanged gets the `preset-copy` warning, so use them to learn from or to bend, not to ship as they are.

The geometry numbers below are illustrative until they are reconciled with the shipped presets in `tools/presets/`. The `facts` hash is from one scan of the fixture. Yours comes from your own scan. The fixture is not a git repo, so `product` has no `commit`.

Render writes the counts line from the scan. Never type it:

```
6 screens, 3 kinds of request, 4 kinds of saved record, 3 outside services (email, payments, sign-in), 1 AI model, runs 1 job on its own
```

### hourglass

Two profile regions meet at a narrow waist. The top holds what you juggle and fades from soft to mid. The bottom holds what comes out, in ink. The hot label sits in the waist.

```json
{
  "version": 3,
  "facts": "d73b88fe2d4e",
  "product": { "name": "Pantry", "repo": "recipe", "date": "2026-11-07" },
  "theme": "light",
  "headline": "A week of dinners, planned in one go.",
  "hot": "leftovers",
  "figure": {
    "fits": "Everything you juggle in a week squeezes through one plan and comes out as a shopping list.",
    "regions": [
      { "kind": "fill", "id": "top", "tone": ["soft", "mid"],
        "words": ["recipes", "cravings", "leftovers", "busy nights", "allergies", "what's in season", "the budget", "family picks"],
        "profile": [[176, 420, 365], [272, 420, 264], [368, 420, 168], [448, 420, 95], [496, 420, 56]] },
      { "kind": "fill", "id": "bottom", "tone": "ink",
        "words": ["shopping list", "tonight's dinner", "Monday's email", "next week"],
        "profile": [[560, 420, 57], [608, 420, 98], [688, 420, 176], [768, 420, 259], [864, 420, 365]] }
    ],
    "texts": [
      { "role": "masthead", "id": "name", "x": 50, "y": 36, "w": 490, "size": 84 },
      { "role": "headline", "id": "headline", "x": 560, "y": 64, "w": 224, "size": 22 },
      { "role": "label", "id": "waist", "text": "One week", "hot": true, "x": 360, "y": 522, "w": 120, "size": 14 },
      { "role": "aside", "id": "in", "text": "What you juggle. Recipes, cravings, leftovers, allergies, busy nights.", "x": 56, "y": 520, "w": 190 },
      { "role": "aside", "id": "plan", "text": "**One plan a week:** seven dinners from your own recipes, with the leftovers used up first.", "x": 594, "y": 526, "w": 190 },
      { "role": "aside", "id": "out", "text": "What comes out. A shopping list, and the plan in your inbox every Monday.", "x": 56, "y": 640, "w": 190 }
    ]
  },
  "notes": [
    { "title": "How it works", "text": "Save the recipes you already cook. Pantry fills the week from them, suggests a few new ones, and builds the shopping list from what the plan needs." },
    { "title": "Every Monday", "text": "At 8 in the morning Pantry emails you the week's plan, so the first dinner is decided before the day starts." },
    { "title": "Yours alone", "text": "Sign in with your own account. Your recipes, plans and lists are saved to it, and you can pick up the week on any device." }
  ],
  "notBuilt": ["paid plans"]
}
```

### ribbon

Three profile regions make one ribbon that runs from top left to bottom right. The middle region is the back face of the twist, set soft so the ribbon reads as turning over. `band: 3` keeps each word for three rows, so the words read as stripes along the ribbon.

```json
{
  "version": 3,
  "facts": "d73b88fe2d4e",
  "product": { "name": "Pantry", "repo": "recipe", "date": "2026-11-07" },
  "theme": "dark",
  "accent": "#9284FF",
  "headline": "Plan it in the kitchen. Shop it in the aisle.",
  "hot": "shopping list",
  "figure": {
    "fits": "The week's plan travels from the kitchen to the shop, and the ribbon is made of what travels.",
    "regions": [
      { "kind": "fill", "id": "near", "tone": "mid", "size": 11, "band": 3,
        "words": ["seven dinners", "shopping list", "amounts"],
        "profile": [[200, 230, 185], [242, 252, 154], [270, 272, 104], [298, 294, 42]] },
      { "kind": "fill", "id": "back", "tone": "soft", "size": 11, "band": 3,
        "words": ["what's left over", "who's eating", "swaps", "seven dinners", "shopping list"],
        "profile": [[312, 306, 61], [354, 343, 146], [403, 387, 186], [452, 430, 141], [494, 467, 55]] },
      { "kind": "fill", "id": "far", "tone": "mid", "size": 11, "band": 3,
        "words": ["amounts", "what's left over", "who's eating", "swaps", "shopping list"],
        "profile": [[508, 479, 48], [564, 529, 158], [606, 566, 185], [648, 599, 150], [704, 630, 35]] }
    ],
    "texts": [
      { "role": "headline", "id": "headline", "x": 56, "y": 56, "w": 470, "size": 40 },
      { "role": "aside", "id": "travels", "text": "**What travels.** Seven dinners, the shopping list with amounts, and what's left over from last week.", "x": 560, "y": 64, "w": 224 },
      { "role": "label", "id": "start", "text": "In the kitchen", "x": 440, "y": 204, "w": 120 },
      { "role": "label", "id": "end", "text": "In the aisle", "x": 680, "y": 698, "w": 104 },
      { "role": "masthead", "id": "name", "x": 56, "y": 740, "w": 330, "size": 48 }
    ]
  },
  "notes": [
    { "title": "How it works", "text": "Pick your recipes for the week. Pantry adds up the ingredients and turns them into one shopping list you can read in the shop." },
    { "title": "Every Monday", "text": "At 8 in the morning Pantry emails you the week's plan and the list, so nothing is left on the kitchen table." },
    { "title": "Yours alone", "text": "Sign in with your own account. Your recipes, plans and lists are saved to it, and you can open them on any device." }
  ],
  "notBuilt": ["paid plans"]
}
```

### eye

The lids are an ellipse with a round hole. The iris is a smaller ellipse with `hot: true`, so every iris row is in the accent. The masthead sits in the middle of the iris, and the fill clears it, which leaves the pupil empty.

```json
{
  "version": 3,
  "facts": "d73b88fe2d4e",
  "product": { "name": "Pantry", "repo": "recipe", "date": "2026-11-07" },
  "theme": "light",
  "headline": "It knows what you cook, then suggests what to cook next.",
  "hot": "new ideas",
  "figure": {
    "fits": "Pantry reads everything you cook and keep, then focuses on the few new recipes worth trying.",
    "regions": [
      { "kind": "fill", "id": "lids", "tone": ["soft", "mid", "soft"], "size": 11,
        "words": ["your recipes", "last week", "leftovers", "allergies", "the season", "busy nights", "the budget", "favourites"],
        "ellipse": { "cx": 420, "cy": 600, "rx": 372, "ry": 280 },
        "holes": [{ "ellipse": { "cx": 420, "cy": 600, "rx": 186, "ry": 186 } }] },
      { "kind": "fill", "id": "iris", "tone": "ink", "size": 11, "hot": true,
        "words": ["tonight's dinner", "new ideas", "the list"],
        "ellipse": { "cx": 420, "cy": 600, "rx": 168, "ry": 168 } }
    ],
    "texts": [
      { "role": "headline", "id": "headline", "x": 56, "y": 52, "w": 520, "size": 40 },
      { "role": "aside", "id": "blurb", "text": "Pantry looks at what you cook, what's left and who's eating, then suggests the few new recipes worth trying this week.", "x": 600, "y": 60, "w": 184 },
      { "role": "masthead", "id": "name", "x": 290, "y": 562, "w": 260, "size": 72 }
    ]
  },
  "notes": [
    { "title": "What it reads", "text": "Your saved recipes and their ingredients, last week's plan, and what you told it about allergies and busy nights." },
    { "title": "What it suggests", "text": "A few new recipes that fit the week, from an AI model. You choose which ones to keep." },
    { "title": "What it sends", "text": "The week's plan by email every Monday at 8, and a shopping list built from the plan." }
  ],
  "notBuilt": ["paid plans"]
}
```

### warm-start

One dots region spells four words in squares, from cold to ink. The last line equals `hot`, so it is set in the accent. With 2 notes the footer is shorter, so the floor is lower and the headline band fits under the letters.

```json
{
  "version": 3,
  "facts": "d73b88fe2d4e",
  "product": { "name": "Pantry", "repo": "recipe", "date": "2026-11-07" },
  "theme": "light",
  "headline": "Every week starts with a question. Pantry answers it on Monday.",
  "hot": "well",
  "figure": {
    "fits": "A week that starts cold and undecided warms up line by line until dinner is settled.",
    "regions": [
      { "kind": "dots", "id": "warm", "lines": ["PLAN", "ONCE", "EAT", "WELL"], "x": 130, "y": 56, "cell": 20, "tones": ["cold", "cool", "ink", "ink"] }
    ],
    "texts": [
      { "role": "headline", "id": "headline", "x": 56, "y": 772, "w": 400, "size": 34 },
      { "role": "masthead", "id": "name", "x": 496, "y": 766, "w": 288, "size": 48 },
      { "role": "aside", "id": "monday", "text": "**Monday at 8:** the week's plan lands in your inbox, so the first dinner is already decided.", "x": 496, "y": 830, "w": 288 }
    ]
  },
  "notes": [
    { "title": "How", "text": "Save the recipes you already cook. Pantry fills the week from them, uses up the leftovers first, and builds the shopping list." },
    { "title": "New ideas", "text": "Ask for a suggestion and Pantry offers a few recipes that fit your week. Keep the ones you like and they join your recipes." }
  ],
  "notBuilt": ["paid plans"]
}
```

## Three invented pictures

None of these is a preset. Each starts from a main moment, finds its verb, and builds a silhouette a person would name at thumbnail size. The products are made up. Each block below is the `figure` only, and its numbers are a first draft to sketch from.

### A bridge for a sync tool

Tandem keeps the files on your phone and your laptop the same. Main moment: the photo you take on your phone is on your laptop when you sit down. The verb is "joins", so the picture is a bridge. Two towers stand on the two banks. The left tower holds what lives on the phone, in soft tones because it is far. The right tower holds what lives on the laptop, in ink because it is where you are. An arched deck between them carries what crosses, and the hot word is on the deck. The water under the deck stays empty paper, which is what makes it a bridge and not a block.

```json
{
  "fits": "A bridge between your phone and your laptop. The deck is made of what crosses it.",
  "regions": [
    { "kind": "fill", "id": "phone", "tone": "soft",
      "words": ["photos", "voice notes", "screenshots", "receipts"],
      "polygon": [[120, 880], [120, 330], [170, 296], [220, 330], [220, 880]] },
    { "kind": "fill", "id": "deck", "tone": "mid",
      "words": ["photos", "notes", "the latest version"],
      "polygon": [[232, 600], [320, 552], [420, 536], [520, 552], [608, 600], [608, 664], [520, 616], [420, 600], [320, 616], [232, 664]] },
    { "kind": "fill", "id": "laptop", "tone": "ink",
      "words": ["folders", "drafts", "downloads", "receipts"],
      "polygon": [[620, 880], [620, 330], [670, 296], [720, 330], [720, 880]] }
  ],
  "texts": [
    { "role": "masthead", "id": "name", "x": 56, "y": 40, "w": 420 },
    { "role": "headline", "id": "headline", "x": 560, "y": 64, "w": 224 },
    { "role": "aside", "id": "left", "text": "On your phone.", "x": 120, "y": 270, "w": 120 },
    { "role": "aside", "id": "right", "text": "On your laptop.", "x": 620, "y": 270, "w": 120 }
  ]
}
```

`hot` is "latest version". It matches a word on the deck.

### A stair for a learning app

Rungs teaches a language ten minutes a day, and each lesson opens the next. Main moment: every lesson you finish is one step up, and the top step is your first real conversation. The verb is "climbs", so the picture is a stair rising from left to right. One polygon draws the lower steps with the early lessons. Its tone runs from soft at the top to ink at the bottom, because the lessons you have done are near and solid. The top step is its own region with `hot: true`, so the goal is the one bright thing on the page.

```json
{
  "fits": "A stair of lessons, one step each, up to your first real conversation at the top.",
  "regions": [
    { "kind": "fill", "id": "steps", "tone": ["soft", "ink"],
      "words": ["greetings", "numbers", "the café", "directions", "small talk"],
      "polygon": [[80, 860], [80, 760], [200, 760], [200, 660], [320, 660], [320, 560], [440, 560], [440, 460], [760, 460], [760, 860]] },
    { "kind": "fill", "id": "top", "tone": "ink", "hot": true,
      "words": ["first conversation", "your own words"],
      "polygon": [[560, 360], [760, 360], [760, 452], [560, 452]] }
  ],
  "texts": [
    { "role": "masthead", "id": "name", "x": 56, "y": 40, "w": 420 },
    { "role": "headline", "id": "headline", "x": 56, "y": 150, "w": 400, "size": 30 },
    { "role": "aside", "id": "daily", "text": "**Ten minutes a day.** Finish a lesson and the next step opens.", "x": 80, "y": 520, "w": 200 }
  ]
}
```

`hot` is "first conversation". The top step alone is a box, but the stair as a whole changes width on every step, so `row-variety` passes.

### A shield for a backup tool

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

## Sample chat reply

```markdown
Pantry plans a week of dinners from the recipes you already cook, then turns the plan into a shopping list and emails it every Monday.

I drew an hourglass: recipes, leftovers, cravings and busy nights pour through one week's plan and come out as a shopping list and a Monday email.

- PNG: /Users/<you>/code/pantry/vyo/recipe-poster.png
- PDF: /Users/<you>/code/pantry/vyo/recipe-poster.pdf

Gaps: the code has payments, but there is no checkout screen, so the poster lists "paid plans" under "Not built yet". The figure started from the hourglass preset, and I reshaped the waist and the bottom so it is Pantry's own. Add `vyo/` to `.gitignore` unless you want to commit the poster.
```

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

Each block below is the preset file in `tools/presets/`, with the same words and geometry. Only the layout of the number lists is tighter. The `facts` value is a placeholder: yours is the hash from your own scan, and `compose` writes it. The fixture is not a git repo, so `product` has no `commit`.

Render writes the counts line from the scan. Never type it:

```
6 screens, 3 kinds of request, 4 kinds of saved record, 3 outside services (email, payments, sign-in), 1 AI model, runs 1 job on its own
```

### hourglass

Two profile regions meet at a narrow waist, 30px each side of x 420 where `inputs` ends at y 512 and `outputs` starts at y 576. The top holds what you juggle and steps from soft to mid. The bottom holds what comes out, in ink. The hot label sits in the gap, `align: "center"` in a wide box, and at size 26 by default.

```json
{
  "version": 3,
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

### ribbon

Three profile regions make one ribbon that runs from top left to bottom right. Each ends on the pinch where the next begins. The middle region is the back face of the twist, set soft so the ribbon reads as turning over. `band: 3` keeps each word for three rows, so the words read as stripes along the ribbon. The two ends are `display` texts, bold sans lines of the poster's own words: "Plan it in the kitchen." at the top and "Shop it in the aisle." at the bottom right, with `align: "right"`.

```json
{
  "version": 3,
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

### eye

The lids are a profile with a hole, and their tone steps soft, mid, soft down the rows. The iris is an ellipse with its own hole and `hot: true`, so every iris row is in the accent. The masthead is centred at size 72 in the hole, and the fill clears it, which leaves the pupil empty.

```json
{
  "version": 3,
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

### warm-start

One dots region spells four words in squares. Its `tones` run cold, cool, ink, hot, and the last line also equals the spec's `hot`, so it is set in the accent. There are no fill regions, so `row-variety` and `one-region` are skipped. With 2 notes the footer is shorter and the floor is 920.

```json
{
  "version": 3,
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

## Three invented pictures

None of these is a preset. Each starts from a main moment, finds its verb, and builds a silhouette a person would name at thumbnail size. The products are made up. Each block below is the `figure` only. Each passes every check with three notes and a short not-built list, but the numbers are a first draft to sketch from.

### A bridge for a sync tool

Tandem keeps the files on your phone and your laptop the same. Main moment: the photo you take on your phone is on your laptop when you sit down. The verb is "joins", so the picture is a bridge. Two towers stand on the two banks. The left tower holds what lives on the phone, in soft tones because it is far. The right tower holds what lives on the laptop, in ink because it is where you are. An arched deck between them carries what crosses, and the hot word is on the deck. The water under the deck stays empty paper, which is what makes it a bridge and not a block.

```json
{
  "fits": "A bridge between your phone and your laptop. The deck is made of what crosses it.",
  "regions": [
    { "kind": "fill", "id": "phone", "tone": "soft",
      "words": ["photos", "voice notes", "screenshots", "receipts"],
      "polygon": [[80, 880], [80, 330], [160, 290], [240, 330], [240, 880]] },
    { "kind": "fill", "id": "deck", "tone": "mid",
      "words": ["photos", "notes", "the latest version"],
      "polygon": [[252, 600], [330, 552], [420, 536], [510, 552], [588, 600], [588, 664], [510, 616], [420, 600], [330, 616], [252, 664]] },
    { "kind": "fill", "id": "laptop", "tone": "ink",
      "words": ["folders", "drafts", "downloads", "receipts"],
      "polygon": [[600, 880], [600, 330], [680, 290], [760, 330], [760, 880]] }
  ],
  "texts": [
    { "role": "masthead", "id": "name", "x": 56, "y": 40, "w": 420 },
    { "role": "headline", "id": "headline", "x": 560, "y": 64, "w": 224 },
    { "role": "aside", "id": "left", "text": "On your phone.", "x": 80, "y": 250, "w": 160 },
    { "role": "aside", "id": "right", "text": "On your laptop.", "x": 600, "y": 250, "w": 160 }
  ]
}
```

`hot` is "latest version". It matches a word on the deck.

### A stair for a learning app

Rungs teaches a language ten minutes a day, and each lesson opens the next. Main moment: every lesson you finish is one step up, and the top step is your first real conversation. The verb is "climbs", so the picture is a stair rising from left to right. One polygon draws the lower steps with the early lessons. Its two tones split it: soft in the upper rows and ink in the lower, because the lessons you have done are near and solid. The top step is its own region with `hot: true`, so the goal is the one bright thing on the page.

```json
{
  "fits": "A stair of lessons, one step each, up to your first real conversation at the top.",
  "regions": [
    { "kind": "fill", "id": "steps", "tone": ["soft", "ink"],
      "words": ["greetings", "numbers", "the café", "directions", "small talk"],
      "polygon": [[80, 860], [80, 760], [200, 760], [200, 660], [320, 660], [320, 560], [440, 560], [440, 460], [760, 460], [760, 860]] },
    { "kind": "fill", "id": "top", "tone": "ink", "hot": true,
      "words": ["first conversation", "your own words"],
      "polygon": [[560, 300], [760, 300], [760, 452], [560, 452]] }
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

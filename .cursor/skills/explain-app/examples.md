# Examples

## Sample prompts

**Client handoff**
> Explain this app to my client as a poster. They need to understand what we built without any code.

**PM overview**
> Walk me through how this product works for a PM. One page, and be honest about what's live.

**Selling**
> Help me talk about my product. Make me a poster I can send to people.

**General**
> Explain what this app does. Visualize the repo as a poster.

**A shape in mind**
> Draw my codebase as an hourglass: everything my users throw at it, squeezed into one plan.

## Choosing the shape

Write the main moment as one sentence first. Then match it against the "fits when" lines from `node tools/vyo.mjs shapes`.

| App | Main moment | Shape | Why |
|---|---|---|---|
| Pantry, a meal planner | Turns your recipes, leftovers and cravings into one week of dinners and a shopping list | `hourglass` | Many messy inputs become one plan, which is then handed on as a list and an email |
| Hypher, a handoff note for coding agents | Save in Claude Code, resume in Codex | `ribbon` | Something travels between two tools. The ribbon is made of what travels |
| Tally, a review inbox for small shops | Reads every review the shop gets and flags the one to answer today | `eye` | It reads everything and focuses on one thing |

If a habit app's main moment were "a streak that warms up day by day", `warm-start` fits: a state that changes over a sequence. If no line fits well, pick the closest and say so in the chat reply.

## Sample specs for Pantry

Pantry is the `recipe` test fixture: 6 screens (recipes, a recipe, a new recipe, the weekly plan, settings, home), recipes with ingredients, a weekly plan, a shopping list, AI suggestions, and a weekly email job every Monday at 8. It has payment code but no checkout screen, so every spec puts "paid plans" in `notBuilt`.

`compose` writes `version`, `facts`, `product`, `theme` and `shape`. The `facts` hash below is from one scan of the fixture. Yours comes from your own scan. Pantry's fixture is not a git repo, so `product` has no `commit`.

Render writes this counts line from the scan. Never type it:

```
6 screens, 3 kinds of request, 4 kinds of saved record, 3 outside services (email, payments, sign-in), 1 AI model, runs 1 job on its own
```

### hourglass

```json
{
  "version": 2,
  "facts": "d73b88fe2d4e",
  "product": { "name": "Pantry", "repo": "recipe", "date": "2026-11-07" },
  "theme": "light",
  "shape": "hourglass",
  "headline": "A week of dinners, planned in one go.",
  "hot": "leftovers",
  "slots": {
    "top": ["recipes", "cravings", "leftovers", "busy nights", "allergies", "what's in season", "the budget", "family favourites"],
    "waist": "ONE WEEK",
    "bottom": ["shopping list", "tonight's dinner", "Monday's email", "next week"],
    "asideLeft": "What you juggle. Recipes, cravings, leftovers, allergies, busy nights.",
    "asideRight": "**One plan a week:** seven dinners from your own recipes, with the leftovers used up first.",
    "asideBottom": "What comes out. A shopping list, and the plan in your inbox every Monday."
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

The ribbon has a dark theme only.

```json
{
  "version": 2,
  "facts": "d73b88fe2d4e",
  "product": { "name": "Pantry", "repo": "recipe", "date": "2026-11-07" },
  "theme": "dark",
  "shape": "ribbon",
  "headline": "The week you plan at home is the list in your hand.",
  "hot": "shopping list",
  "slots": {
    "leftLine": "Plan it in the kitchen.",
    "rightLine": "Shop it in the aisle.",
    "travels": ["seven dinners", "shopping list", "amounts", "what's left over", "who's eating", "swaps"],
    "aside": "**What travels.** Seven dinners, the shopping list with amounts, and what's left over from last week."
  },
  "notes": [
    { "title": "How it works", "text": "Pick your recipes for the week. Pantry adds up the ingredients and turns them into one shopping list you can read in the shop." },
    { "title": "Every Monday", "text": "At 8 in the morning Pantry emails you the week's plan and the list, so nothing is left on the kitchen table." },
    { "title": "Yours alone", "text": "Sign in with your own account. Your recipes, plans and lists are saved to it, and you can open them on any device." }
  ],
  "notBuilt": ["paid plans"]
}
```

### warm-start

`warm-start` has 2 notes. Each line is a word of at most 5 letters, and `hot` is the last line.

```json
{
  "version": 2,
  "facts": "d73b88fe2d4e",
  "product": { "name": "Pantry", "repo": "recipe", "date": "2026-11-07" },
  "theme": "light",
  "shape": "warm-start",
  "headline": "Every week starts with a question. Pantry answers it on Monday.",
  "hot": "well",
  "slots": {
    "lines": ["PLAN", "ONCE", "EAT", "WELL"],
    "aside": "**Monday at 8:** the week's plan lands in your inbox, so the first dinner is already decided."
  },
  "notes": [
    { "title": "How", "text": "Save the recipes you already cook. Pantry fills the week from them, uses up the leftovers first, and builds the shopping list." },
    { "title": "New ideas", "text": "Ask for a suggestion and Pantry offers a few recipes that fit your week. Keep the ones you like and they join your recipes." }
  ],
  "notBuilt": ["paid plans"]
}
```

### eye

```json
{
  "version": 2,
  "facts": "d73b88fe2d4e",
  "product": { "name": "Pantry", "repo": "recipe", "date": "2026-11-07" },
  "theme": "light",
  "shape": "eye",
  "headline": "It knows what you cook, then suggests what to cook next.",
  "hot": "new ideas",
  "slots": {
    "lids": ["your recipes", "last week", "leftovers", "allergies", "the season", "busy nights", "the budget", "favourites"],
    "iris": ["tonight's dinner", "new ideas", "the list"],
    "blurb": "Pantry looks at what you cook, what's left and who's eating, then suggests the few new recipes worth trying this week."
  },
  "notes": [
    { "title": "What it reads", "text": "Your saved recipes and their ingredients, last week's plan, and what you told it about allergies and busy nights." },
    { "title": "What it suggests", "text": "A few new recipes that fit the week, from an AI model. You choose which ones to keep." },
    { "title": "What it sends", "text": "The week's plan by email every Monday at 8, and a shopping list built from the plan." }
  ],
  "notBuilt": ["paid plans"]
}
```

## Sample chat response

```markdown
Pantry plans a week of dinners from the recipes you already cook, then turns the plan into a shopping list and emails it every Monday.

I used the hourglass: many messy inputs (recipes, leftovers, cravings, busy nights) squeeze into one week's plan, which then goes out as a list and an email.

- PNG: /Users/<you>/code/pantry/vyo/recipe-poster.png
- PDF: /Users/<you>/code/pantry/vyo/recipe-poster.pdf

Gaps: the code has payments, but there is no checkout screen, so the poster lists "paid plans" under "Not built yet". Add `vyo/` to `.gitignore` unless you want to commit the poster.
```

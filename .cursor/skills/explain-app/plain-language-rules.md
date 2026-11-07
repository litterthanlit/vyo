# Plain language rules

These rules cover every word you write into the poster spec: the headline, the region words, the texts, the notes and `notBuilt`. Render checks the banned terms and file paths for you. The rest is your judgment.

## Principles

1. **Outcomes first.** "Dinner is decided before Monday starts" comes before anything about how the app is built.
2. **The user's words.** Describe what people see, do and get, in the words they use for it.
3. **Honest status.** Only what a user can do today goes in the figure and the notes. Everything else goes in `notBuilt`.
4. **One idea per sentence.** Short sentences, no nested clauses.
5. **Replace, never define.** The poster has no glossary. If a term needs explaining, use a plainer word.

## Banned terms

Render rejects any word in the first column, in any visible text. Use the second column instead. Vendor names are not on this list. The naming rules below cover them.

| Instead of | Say |
|------------|-----|
| api | Name the action: "saves your recipe", "sends the request" |
| endpoint | Name the action the request does |
| endpoints | "kinds of request", or name the actions |
| middleware | "a check that runs before the page opens" |
| orm | "looks up your data", "saves it" |
| webhook | "a message from [service] when something happens" |
| webhooks | "messages from [service]" |
| deploy | "goes live" |
| deployment | "the live app" |
| env var | Leave it out |
| frontend | "what you see" |
| backend | "what runs behind the scenes" |
| monorepo | Leave it out. Name the product |
| sdk | Name the action the user gets |
| graphql | Leave it out. Describe the action |
| component | "screen", "section", "part of the app" |
| components | "screens", "parts of the app" |
| module | "part of the app" |
| modules | "parts of the app" |
| repository | "project", or the product name |
| repo | "project", or the product name |
| commit | Leave it out. The footer already names the version |
| commits | Leave it out |
| pr | Leave it out |
| mvp | "what's live now" |
| leverage | "use" |
| utilize | "use" |
| platform | "app", or the product name |
| ecosystem | Leave it out |
| synergy | Leave it out |
| holistic | Leave it out |
| disruptive | Leave it out. Show the contrast instead |
| revolutionary | Leave it out. Show the contrast instead |

## Naming the words in the figure

Region words build the picture, so each one must make sense on its own to someone who has never seen the code.

- **Use the user's words.** "Shopping list", not the name of the folder that builds it. "Recipes", not the name of the table that stores them.
- **Use nouns.** Region words are things that go in, travel or come out: "leftovers", "seven dinners", "the plan". A verb phrase belongs in an aside or a note.
- **Give each region its own words.** The words in one region share a job: what goes in, what comes out, what crosses. Don't repeat a whole list across regions unless the picture is one thing seen twice, like the two faces of a ribbon.
- **No role words.** Screen, table, service, request, job, model and schema describe how code is organised, not what a user gets. The footer's counts already use them in plain phrases like "4 kinds of saved record". Don't repeat those in the figure.
- **No vendor names, unless the user can use that vendor today.** "Claude Code" and "Codex" are fine on Hypher's poster because a user connects them. "Stripe" is not fine on a poster for an app with no checkout screen. Say "payments" in `notBuilt` instead.
- **No counts.** Render writes every count from the scan. A word like "6 screens" can drift from the code.

## Naming the hot word and labels

- **One hot word.** `hot` is the one word or two-word phrase that matters most. It is the only text in the accent colour, so it carries the poster's point. Put it where the main moment happens: the waist, the iris, the top step.
- **A hot label is a noun phrase of one to three words.** "One week", "One note", "Last night". It names what everything becomes. It is not a slogan and not a verb.
- **A plain label names a place in the picture.** "In the kitchen", "On your phone". Keep it to a few words, and never use it to explain the figure. That is the job of an aside.
- **Asides are sentences.** One or two plain sentences about one part of the picture. An aside may start with a `**bold phrase**`.

## Voice for the headline

- One sentence about the outcome for the user. "A week of dinners, planned in one go." Not "Recipes, plans and AI suggestions."
- Plain and calm. No exclamation marks, no superlatives, no questions.
- At most 72 characters, so it stays on two lines or fewer.

## Voice for the notes

Each note is a short title and two or three sentences. The notes say what the picture cannot.

- **How it works.** The steps a user takes, as actions: "Save the recipes you cook. Pantry fills the week from them."
- **Proof.** Something real and dated, if the docs have one: a recorded run, a first customer, a test the user can repeat. If there is no proof, use the column for what happens on its own ("Every Monday at 8, the plan arrives by email").
- **What stays private.** What the product keeps and what it never keeps, in plain words.

Write "you" for the user and the product name for the app. Never "the system" or "the platform".

## Status honesty

| Where it goes | When |
|---|---|
| Figure, headline and notes | A user can do it in the app today |
| `notBuilt` | The code has it, but no screen lets a user use it yet. A payment library with no checkout screen. An email job with no way to turn it on |
| Nowhere | It is planned but not in the code |

Never describe a `notBuilt` item as something a user can do. One honest gap builds more trust than a full list of claims.

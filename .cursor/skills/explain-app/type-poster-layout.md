# Type Poster (optional page 4)

The type poster explains a product with one picture made of its own words. It is not a Swiss poster. It has its own warm paper, monospace words, and one orange accent, and `poster.mjs check` judges it by its own rules (see [tools/README.md](tools/README.md)).

Make one only when the user asks for a type poster, a vortex, a poster that moves, or something to share that feels less like a diagram. Pages 1 to 3 stay the default set.

## The shape

The vortex shows "everything in one place". Rings of words spiral in toward a still centre:

| Zone | Words | How they're drawn |
|------|-------|-------------------|
| Outer rings | What the product replaces, in the reader's own words ("client emails", "final_final_v3") | Grey, broken into arcs, drifting |
| Inner rings | The product's loop, in order ("brief", "design", "review", "ship") | Ink, closed, lined up into columns |
| Innermost ring | The one thing that matters (`accent`) | Orange, the only colour on the page |
| Centre | Two short lines (`centre`) | Orange title, grey subtitle |

Pick another shape only when the vortex would lie. A product that squeezes many inputs into one output suits an hourglass. A product that moves work between two places suits a ribbon. See `explorations/2026-10-29-type-posters` for both.

## Choosing the words

- `outside`: 8 to 12 items. Use the reader's mess, not features. File names and half-questions ("who has the brief") work because people recognise them.
- `inside`: 5 to 8 steps of the real loop, taken from the page 1 journeys. Never invent a step the app doesn't have.
- `accent`: 1 to 3 words. It is the outcome, not the product name.
- `notes` and `columns`: plain sentences under [plain-language-rules.md](plain-language-rules.md). Each column says one thing: what comes in, what it keeps, what goes out.

## Live

`LIVE = true` brings the canvas to life:

- Outer rings drift in opposite directions and their letters wobble. The inner loop turns slowly as one piece, so its columns stay lined up.
- Wherever the reader points, the mess straightens out and darkens to ink. The pointer acts out what the product does.
- A "Hold still" / "Bring to life" button flips it. The state key is `liveType`.
- Readers who ask for reduced motion get the still poster. Pointing still brings order, because that motion follows their own hand.
- `export` always draws the still frame and hides the button.

Use `LIVE = false` when the poster will mostly be printed or shown on a projector with no mouse.

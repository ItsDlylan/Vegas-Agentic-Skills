# Shot planning

The intake + storyboard step. **Do not skip.** Guessing at flows produces generic videos.

## 1. Intake — collect for every screen

Use `AskUserQuestion` when the user is vague. Don't start writing components until you have all of this for *every* screen in the flow.

**Per screen:**

1. **Stills** — 2–4 screenshots showing interaction states:
   - resting state (the screen at rest)
   - mid-interaction (button pressed, field focused, sheet halfway, etc.) — this is the most often skipped and most important
   - result state (data loaded, success, next screen)
   - optional: variant worth showing (empty vs. filled, light vs. dark)
2. **What the feature does** — one or two sentences. What does this screen do for the user, and what makes it feel good? This drives which detail to zoom into.
3. **The single moment that proves it works** — if you could only show one piece of UI in motion, what would it be? (This becomes the focal element of the beat.)

**Per video (overall):**

4. **Order** — sequence of screens.
5. **Brand color / accent** — usually pulled from the stills, but ask if it's not obvious.
6. **Font** — only ask if non-standard. Default to the platform's house font (see [platform-defaults.md](./platform-defaults.md)).
7. **Aspect ratio** — only ask if not obvious from context. Defaults per platform.
8. **End-card text / CTA** — optional. Often just a logo + one-line tagline.

## 2. Pick the focal element per beat

For each screen, identify the **single piece of the feature that proves it works**. Examples:

| Feature claim | Focal element |
|---|---|
| "Search is fast" | The search input being typed into + first result appearing |
| "You can reorder cards by dragging" | One card being dragged, the others reflowing |
| "Settings open in a sheet" | The sheet sliding up from the bottom |
| "Stats update live" | The number ticking up + the bar chart filling |
| "The empty state guides you" | The empty illustration → the first item appearing in its place |
| "It autocompletes" | The dropdown opening + an option highlighting |

If you can't name the focal element in one sentence, you don't understand the feature yet. Ask.

## 3. Sketch the timeline

Before writing a single component, lay out the timeline as text. For each beat:

```
Beat 1 — "Search anything in milliseconds" (180 frames @ 30fps = 6s)
  focal: search input + first result row
  motion: cursor enters at center, slides to input → click → typing → result row springs in from below
  cursor: yes (interactive)
  caption: rises in @ frame 0–14, holds for whole beat
  end: crossfade to beat 2

Beat 2 — "Tap to add it to your binder" (150 frames = 5s)
  focal: the result row + a "+" button
  motion: cursor (already on screen from beat 1, glides from input down to "+") → click → row slides into binder slot
  cursor: yes (continuous from beat 1)
  caption: rises in fresh (different text)
  end: outro card

Total: 180 + 150 - 15 (transition overlap) = 315 frames = 10.5s
```

Show this sketch to the user before writing code. A bad timeline is much cheaper to fix as text than as TSX.

## 4. Map stills to slices

For each beat, decide which still it crops from and which region of the still you're slicing. Sketch it as text:

```
Beat 1 slice from search-resting.png:
  - region: x=120 y=240 w=840 h=180 (search bar area)
  - background: full still blurred at 0.4 opacity behind the slice
Beat 1 result-row slice from search-mid.png:
  - region: x=120 y=440 w=840 h=120 (first result row)
  - reveal: spring up from below at frame 60
```

This becomes the spec the components implement.

## 5. Compositions

One `<Composition>` per onboarding flow in `Root.tsx`. One `<Sequence>` (or `<TransitionSeries.Sequence>`) per beat inside it. Use `calculateMetadata` if you want the duration to be derived from the beat configuration rather than hardcoded.

For development convenience, also register **per-beat compositions** with `defaultProps={{ beatOnly: 'beat1' }}` so the user can preview a single beat in Remotion Studio without rendering the whole flow. Match the PokemonTCG `sceneOnly` pattern.

## 6. Iterate

After the first render:

1. Show it to the user (or save the MP4 path so they can play it).
2. Ask for **per-beat** feedback: which beat is too slow, too fast, restaged, wrong focal slice.
3. Treat the first render as a draft. Expect 2–3 render iterations before sign-off.

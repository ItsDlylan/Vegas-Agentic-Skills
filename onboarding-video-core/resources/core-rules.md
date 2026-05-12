# Onboarding video — core rules (platform-neutral)

These rules apply to **every** onboarding video, regardless of platform (web / electron / iOS). Read in addition to the platform-specific SKILL.md.

## What you're making

A short, punchy video that **proves a feature works** by showing a piece of the UI in action — not a tour, not a tutorial, not a screen recording, not a marketing reel. Think App Store preview / Linear feature card / Raycast hero clip — the camera is parked on the moment the feature does its job, and every detail looks like the team spent real money on it.

- **Length:** 3–8 seconds **per beat**. Whole video rarely exceeds ~30 seconds.
- **Beats per video:** typically 2–5. One feature, one video. If the user lists five unrelated features, propose five videos.
- **fps:** 30. Always. Don't use 60 unless the user explicitly asks.
- **Voice:** none. Captions only. The motion carries the meaning.
- **Quality bar:** every video must clear the bar in [production-quality.md](./production-quality.md). The defaults below get you to a clean draft; the production bar is what makes it look paid-for instead of elementary. **Read it before sketching shots, not after rendering.**

## Pieces of the UI, not the whole UI

The single rule that defines this skill.

- Each beat shows **one focal component** in motion: a button being clicked, a row reordering, a toggle flipping, a chart filling, an empty state turning into a populated state, a sheet sliding open.
- The focal component is **cropped, masked, or extracted** from the supplied still, then wrapped in a "presented" container with shadow and faint border (see [production-quality.md](./production-quality.md) → Focal slice presentation). Slices that float on the background without depth read as cheap cutouts.
- The rest of the chrome is omitted, blurred, or implied by a layered background (mesh gradient + vignette + ambient light — never flat color).
- If you catch yourself rendering a full-screen mockup, **stop and crop down**. The viewer should see *the feature in action*, not a tour of the app.
- See [crop-techniques.md](./crop-techniques.md) for how to extract focal elements.

## The hero beat — one per video

Every video has exactly one "money shot" — the beat that delivers the feature's promise. Identify it during shot planning and design it with extra weight:

- Slightly slower focal motion (~20%) than the surrounding beats. Pacing tells the viewer "this is the point."
- 6–10 frames of held still before the action starts, 12–18 frames of held still on the result before crossfading out. Breathing room.
- Optional accent glow on the focal slice container (brand-accent box-shadow, ~60px blur, ~0.3 opacity).

Without a hero beat, every video reads as a sequence of equally-weighted moments and feels flat. See [production-quality.md](./production-quality.md) → Hero beat.

## Stills are required

Do not invent UI from descriptions. If the user hasn't supplied stills:

1. Ask for them.
2. Or, for web/electron projects only, offer to capture them yourself by running the dev server and using `agent-browser` (web) or the running app (electron). Do **not** invent.
3. For each screen, ask for **2–4 stills**: resting state, mid-interaction, result state, optional variant.

See [shot-planning.md](./shot-planning.md) for the full intake checklist.

## Captions

Captions are non-negotiable — most viewers watch with sound off, and the video has no voiceover. The caption *is* the narrative.

- **Anchored top-of-frame, fixed position across every beat.** Reserve a ~200–240px caption band at the top. Never put a caption below the focal UI. Never let it drift between beats.
- **Rise-in from below + fade-in.** Each caption starts ~60px below its rest position with `opacity: 0`, then slides up + fades in together over ~10–14 frames using `Easing.bezier(0.16, 1, 0.3, 1)`.
- **Visible the entire beat.** Caption fades in within the first ~14 frames of its beat and stays on screen for the *whole* sequence. Do not delay entry to mid-beat. Do not fade out before the beat ends — the scene-level crossfade between beats carries the swap.
- **Big.** Default for a 1080-wide canvas: 54px, weight 700, with a `maxWidth` so long lines wrap. Headline-size, not subtitle-size.
- **Same caption across connected beats stays put.** When two consecutive beats are conceptually one moment and share the *exact same caption text*, the caption rises-and-fades-in on the first beat and renders with `staticEntry` on the continuation beat (instant full opacity, rest position, no slide). This makes it read as one persistent caption across the cut, not a flicker. **Only** use this when the text is *exactly* the same; if it changes at all, let the new caption rise-and-fade-in normally.
- See [top-caption.md](./top-caption.md) for the drop-in component.

## Pointer / cursor / finger — leads every interaction

If a beat shows a *click, tap, or selection*, an indicator must appear, **move along a path**, and arrive on the target before the click/tap fires. The motion is what tells the viewer where to look. A click ripple alone is not enough.

Beats that are purely *illustrative* (highlighting a feature, animating a static result, showing data land) do **not** need a pointer/finger — let glow / motion carry the eye. Decide per beat: **interactive → indicator leads; illustrative → no indicator.**

### The motion rules (apply to mouse cursor AND touch finger)

1. **Fade in at the visual center** of the focal area — the slice center / container center / wherever the viewer's eye is parked. The indicator materialises in place. **Never enter from off-frame.**
2. **One single straight move** from that center to the interaction point. Direction is free — vertical, horizontal, **diagonal** are all fine, as long as it's *one straight segment*. Both `x` and `y` may change together (this is the only place a diagonal is allowed). Use a single decelerating ease (e.g. `Easing.bezier(0.16, 1, 0.3, 1)`).
3. **Multiple interactions on the same UI:** the indicator stays visible and glides from one target to the next in continuous straight segments. Do **not** reset between taps on the same UI.
4. **Different UI / new screen:** the indicator fades out and the next interaction starts with a fresh fade-in at center. The reset is what tells the viewer "we're somewhere new now."

### Forbidden

- Entering from off-frame edges
- Multi-segment paths within a single move
- Curves, zig-zags, intermediate keyframes that bend the trajectory
- Fading out + back in between taps on the **same** UI

The motion should feel like the user's finger/cursor **appearing where the eye already is** and gliding straight to each action — not like a hand entering from off-screen, and not like the indicator blinking out between every tap on the same form.

- For mouse cursor (web/electron) → see [pointer-cursor.md](./pointer-cursor.md).
- For finger/touch (iOS) → see [touch-indicator.md](./touch-indicator.md).

## Motion vocabulary

The visual identity. Use these consistently — and **vary easings across elements within a single beat**. Same-easing-everywhere is the #1 amateur tell.

- **Spring over linear** — `spring({ frame, fps, config: { damping: 200 } })` for smooth no-bounce reveals; `damping: 20, stiffness: 200` for snappy UI; `damping: 12, stiffness: 100` for elastic entrances.
- **`Easing.bezier(0.16, 1, 0.3, 1)`** — the workhorse decelerating ease for captions, cursor glides, fades. Default, not universal.
- **`Easing.bezier(0.34, 1.56, 0.64, 1)`** — slight overshoot, for elements that should feel responsive (badges popping in, button confirmations).
- **`Easing.bezier(0.83, 0, 0.17, 1)`** — strong ease-in-out, for hero reveals (the moment the feature "lands").
- **Anticipation** (2–4 frame pull-back before a forward motion) and **settle** (6–10 frame overshoot of ~2–4px after a fast move) — add weight and "alive" feel.
- **Masked reveals** via `clip-path: inset(...)` for wipes that respect rounded corners.
- **Crossfades** between beats via `<TransitionSeries>` with `linearTiming({ durationInFrames: 12-18 })` or `springTiming` with `damping: 200`. **Never `fade-to-black`** — that reads as "next chapter," not "next beat."
- **Shared-element transitions** when the same logical UI element appears in adjacent beats — animate the source's position/scale into the target's; don't pop.
- **Subtle parallax** on layered slices (1.02–1.06 scale shift) gives depth without distracting.

See [production-quality.md](./production-quality.md) → Motion variety for the easing table.

## Forbidden

- CSS `transition`/`animation`, Tailwind `transition-*` / `animate-*` classes — they will not render correctly. Drive everything from `useCurrentFrame()`.
- Native `<img>` — always `<Img>` from remotion.
- Voiceovers, big text overlays explaining the feature, rendered logos taking up the frame.
- Restyling the app's design language. Use the colors, corner radii, type and spacing from the supplied stills. Don't "improve" them. (But the *framing* around the slice — background, depth, lighting — is yours to design.)
- Beats longer than 8 seconds. If something needs more, split it.
- "Tour" framing — wide shot of the whole app pulled back. Always crop in.
- Pure `#fff` or `#000` backgrounds with no gradient, vignette, or ambient light.
- Naked focal slices — every slice must sit in a presented container with shadow + faint border.
- Fade-to-black between beats. Use content crossfades or shared-element transitions.
- Static end cards — logo-on-black with no motion is the "I gave up" signal.

See [production-quality.md](./production-quality.md) → Anti-tells for the full list of what reads as elementary.

## Render & deliver

The platform skill tells you the exact output path and codec setup. In general:

- Default codec: H.264 (`yuv420p`) for MP4. ProRes only if the user asks.
- Run a draft render first at low quality, **then run the 11-question QA pass from [production-quality.md](./production-quality.md)** before showing it to the user. Earlier drafts waste the user's time correcting things you'd catch yourself.
- After the QA pass, show the draft to the user, ask which beats need to be slower / faster / restaged. Expect 2–3 iterations after sign-off.
- For UI verification, also render a single still for each beat (`remotion still ...`) so the user can sanity-check the focal slice before committing to a full render.

## Delegate

- **`remotion-best-practices`** — invoke before writing any Remotion code. It is the source of truth for compositions, sequencing, timing, fonts, transitions, images. Do not duplicate or contradict it.
- **`agent-browser`** — for web projects, use it to capture stills from the running dev server when the user hasn't supplied screenshots.

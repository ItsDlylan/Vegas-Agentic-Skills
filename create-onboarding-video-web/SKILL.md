---
name: create-onboarding-video-web
description: Produce short, punchy onboarding videos in Remotion for web apps that showcase a feature in action by animating isolated pieces of the UI (cropped components, not full screens) with nice UI-like transitions and a mouse cursor that leads every click. Use when the user asks to create, build, or generate an onboarding video, feature demo clip, in-app walkthrough, marketing reel, or any short video that demonstrates a web/SaaS feature using supplied screenshots.
---

# Create Onboarding Video — Web

A web-app variant of the onboarding video skill. The video plays inside the app (feature tour modal, settings tutorial, marketing landing) or as a social clip. Mouse cursor leads every click. Default canvas is **1920×1080 (16:9)** for in-app use; switch to **1080×1920 (9:16)** for social.

## Read these first

The platform-neutral rules and component specs live in the shared core. **Read them in order** before writing any composition:

1. [../onboarding-video-core/resources/core-rules.md](../onboarding-video-core/resources/core-rules.md) — what you make, the pieces-not-screens rule, hero beat, captions, cursor motion, motion vocabulary, forbidden moves
2. [../onboarding-video-core/resources/production-quality.md](../onboarding-video-core/resources/production-quality.md) — **the bar.** Reference standards, material identity, presented containers, motion variety, premium click feedback, content animations, QA pass, anti-tells of "elementary." Read this *before* sketching shots, not after rendering.
3. [../onboarding-video-core/resources/shot-planning.md](../onboarding-video-core/resources/shot-planning.md) — intake checklist, focal-element selection, timeline sketching
4. [../onboarding-video-core/resources/crop-techniques.md](../onboarding-video-core/resources/crop-techniques.md) — clip-path, overflow-hidden wrappers, presented-container wrapper, layered backgrounds, shared-element transitions
5. [../onboarding-video-core/resources/top-caption.md](../onboarding-video-core/resources/top-caption.md) — drop-in `TopCaption` component (web defaults: 64px / maxW 1400 / topOffset 80 / letter-spacing -2 for landscape; mixed-weight emphasis)
6. [../onboarding-video-core/resources/pointer-cursor.md](../onboarding-video-core/resources/pointer-cursor.md) — drop-in `Pointer` component (mouse arrow + ripple); layer pre-click glow + cursor depression + second ring for premium feel
7. [../onboarding-video-core/resources/platform-defaults.md](../onboarding-video-core/resources/platform-defaults.md) — quick-reference table for dimensions, fonts, paths

## Web-specific workflow

### 1. Detect the project

Read `package.json` to confirm Remotion is installed. Look for an existing `remotion/` directory. If you find one (e.g. PokemonTCG: `remotion/src/Root.tsx`, `npm run remotion:dev`), match its conventions exactly:

- Compositions live in `remotion/src/Root.tsx`
- Scenes in `remotion/src/scenes/`, components in `remotion/src/components/`
- Stills in `remotion/public/`
- House fonts loaded via Google Fonts `<link>` in Root.tsx (or via `@remotion/google-fonts`)

If no `remotion/` directory exists, ask the user whether they want one bootstrapped before doing anything else. Don't silently install.

### 2. Intake — getting stills

Web projects have an advantage: you can capture stills yourself.

**Option A — user supplies them.** Default for first-time use. Ask for 2–4 stills per screen using `AskUserQuestion`. Save them to `remotion/public/<screen-name>/<state>.png`.

**Option B — you capture them via `agent-browser`.** When the user says "the dev server is running at http://localhost:3000" or similar, use the existing `agent-browser` skill to capture states:

```bash
# Capture a sequence of states — example for a search feature
agent-browser --headed --session onboard open http://localhost:3000/cards
agent-browser --headed --session onboard screenshot remotion/public/search/01-resting.png
agent-browser --headed --session onboard fill @e7 "Charizard"
agent-browser --headed --session onboard screenshot remotion/public/search/02-mid.png
agent-browser --headed --session onboard wait --text "First Edition Charizard"
agent-browser --headed --session onboard screenshot remotion/public/search/03-result.png
agent-browser --headed --session onboard close
```

Always crop the screenshots to a clean focal region after — full-page screenshots are noisy. The `crop-techniques.md` patterns assume you know the pixel coordinates of the focal element in the still.

### 3. Plan the shots

Follow [shot-planning.md](../onboarding-video-core/resources/shot-planning.md). For web specifically:

- Decide aspect ratio first. **In-app feature tour or marketing landing → 1920×1080.** Social (Twitter/LinkedIn/Instagram) → 1080×1920. If unsure, ask.
- For dashboards or wide UIs, the focal element is often a card or panel — crop tight, don't show the whole dashboard.
- For form-heavy flows, multiple clicks happen on the same UI — use one `Pointer` instance with multiple hops (see [pointer-cursor.md](../onboarding-video-core/resources/pointer-cursor.md)).

### 4. Build with Remotion

**Always invoke the `remotion-best-practices` skill before writing Remotion code.** Include this guidance in your prompt to it:

> Build a short onboarding video for a web app that has to look professionally made — App Store Preview / Linear changelog / Raycast hero clip / Tella export quality. Not "made in Remotion in an afternoon."
>
> **Pieces, not screens.** Each beat shows one *piece of the feature in action*: an isolated/cropped/masked UI component animating through the interaction. The rest of the chrome is omitted. If you catch yourself rendering a full screen, crop down.
>
> **Every focal slice gets a presented container** — `borderRadius: 16, overflow: hidden, boxShadow: '0 30px 80px rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)'`. Slices floating naked on the background read as cutouts.
>
> **Layered background, never flat color.** Compose base color + mesh gradient (2-3 large blurred radial blobs of related brand hues at ≤0.25 opacity) + ambient light blob behind/above the focal slice (~0.4 opacity in brand accent, blurred 80-120px, drifting ~40px over 8s) + vignette (`radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.35) 100%)`). For richer brands, add a heavily-blurred copy of the still at ~0.35 opacity. Pure `#fff` or `#000` are forbidden.
>
> **Hero beat: exactly one per video.** The money shot. Slower focal motion (~20%), 6-10 frames of breathing room before action, 12-18 frames held still on the result, accent glow on the focal slice container.
>
> **Vary easings within each beat.** Workhorse `Easing.bezier(0.16, 1, 0.3, 1)` for fades; `Easing.bezier(0.34, 1.56, 0.64, 1)` for elements that pop in with slight overshoot; `Easing.bezier(0.83, 0, 0.17, 1)` for hero reveals. Add 2-4 frame anticipation pull-backs before forward motion, 6-10 frame settle overshoots after fast moves. Same-easing-everywhere is the #1 amateur tell.
>
> **Spring-based motion, masked reveals via `clip-path`, shared-element transitions between adjacent beats** (animate position/scale of the source slice into the target's, don't pop). Crossfades via `<TransitionSeries>` with `linearTiming({ durationInFrames: 12-18 })`. **Never fade-to-black** between beats — that reads "next chapter," not "next beat."
>
> **Cursor leads every click with the full feedback stack:** pre-click hover glow (4-6 frames before the click, soft radial highlight on target at ~0.2 opacity), cursor depression on click (scale 1.0 → 0.92 → 1.0 over 9 frames), multi-ring ripple (two concentric rings staggered by 4 frames), optional target depression (button slice dips brightness ~6% and scales ~0.98 for 2-3 frames). Single-ring ripple with no cursor reaction is amateur. Cursor fades in at the focal area center, one single straight glide to each hop — never enters from off-frame.
>
> **Captions: 5-7 words max, weight 500 with the meaning-carrying noun in weight 800 (`<strong>`), letter-spacing -1.5 to -2 at display sizes (never -0.5).** Use the `TopCaption` component with `children` for mixed-weight emphasis. Consider left-aligning the caption when the focal slice sits off-axis.
>
> **Animate the actual content that proves the feature works** — typewriter per-character reveal at 50-90ms with blinking caret for typing; counter rolls over 30-45 frames for stat reveals; staggered spring-in (8-12 frame stagger between rows) for list/result reveals. Static "data appears instantly" undersells the feature.
>
> Keep each beat 90–210 frames at 30fps. Stills go in `public/<screen>/<state>.png` and load via `staticFile()`. Use the project's existing fonts (read tailwind.config.js or check Root.tsx for the font setup) — do not restyle the app. Default canvas 1920×1080; expose width/height as props so the same scenes can render at 1080×1920 if asked. Drop in `TopCaption` and `Pointer` from the onboarding-video-core/resources/ docs. **Before showing the user the draft, run the 11-question QA pass from `production-quality.md`.**

Project conventions to follow:

- One `<Composition>` per onboarding flow in `Root.tsx`. Also register **per-beat compositions** with `defaultProps={{ beatOnly: 'beat1' }}` for preview convenience (mirror the PokemonTCG `sceneOnly` pattern).
- Components in `remotion/src/scenes/<flow-name>/` and `remotion/src/components/`.
- `TopCaption.tsx` and `Pointer.tsx` go in `remotion/src/components/` — shared across all flows.
- Use the project's existing animation primitives if any exist (e.g. PokemonTCG has `FadeSlideIn`, `ElasticBounce`). Don't duplicate them.

### 5. Render and iterate

```bash
# Studio for live preview
npm run remotion:dev   # or: pnpm run remotion:dev / yarn / bun

# Render the full flow at draft quality first
npx remotion render --config=remotion/remotion.config.ts remotion/src/index.ts <FlowId> out/<flow-name>-draft.mp4 --jpeg-quality=70

# Per-beat still for sanity checks
npx remotion still --config=remotion/remotion.config.ts remotion/src/index.ts <BeatId> out/<beat>-frame.png --frame=60
```

Show the draft to the user. Ask **per-beat** what to change. Treat the first render as a draft — expect 2–3 iterations.

## Web-specific gotchas

- **Tailwind in Remotion** — fine, but never use `transition-*` or `animate-*` Tailwind classes. Animate via `useCurrentFrame()`. See [../../skills/remotion-best-practices/rules/tailwind.md](../../skills/remotion-best-practices/rules/tailwind.md) (or invoke the skill).
- **High-DPI screenshots** — capture at 2x and let Remotion downscale via `width` styling, not the other way around. Sharper.
- **Dark mode** — if the app supports both, ask which one to feature. Don't render both unless the user asks.
- **Existing project's font loading** — if the project loads fonts via `<link>` in Root.tsx (PokemonTCG pattern), your new caption and other text components inherit those automatically by setting `fontFamily: 'inherit'` or referencing the family name. Don't add a parallel font loading mechanism.

## When in doubt

Ask. A 10-second clarifying question saves a 2-minute render that misses the point.

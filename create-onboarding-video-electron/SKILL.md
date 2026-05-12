---
name: create-onboarding-video-electron
description: Produce short, punchy onboarding videos in Remotion for Electron desktop apps that showcase a feature in action by animating isolated pieces of the UI (cropped components, not full screens) with mouse-cursor-led interactions, sized for in-app tutorial overlays. Use when the user asks to create, build, or generate an onboarding video, tutorial clip, in-app feature demo, or welcome video for a desktop Electron app using supplied screenshots.
---

# Create Onboarding Video — Electron

An Electron-app variant of the onboarding video skill. Designed for in-app **tutorial overlays** (Welcome, Getting Started, feature walkthroughs) that play inside the app at a fixed size. Mouse cursor leads every click. Default canvas is **1280×720 (16:9)** — matches the AgentCanvas tutorials pattern.

## Read these first

The platform-neutral rules and component specs live in the shared core. **Read them in order** before writing any composition:

1. [../onboarding-video-core/resources/core-rules.md](../onboarding-video-core/resources/core-rules.md) — what you make, the pieces-not-screens rule, hero beat, captions, cursor motion, motion vocabulary, forbidden moves
2. [../onboarding-video-core/resources/production-quality.md](../onboarding-video-core/resources/production-quality.md) — **the bar.** Reference standards, material identity, presented containers, motion variety, premium click feedback, content animations, QA pass, anti-tells of "elementary." Read this *before* sketching shots, not after rendering.
3. [../onboarding-video-core/resources/shot-planning.md](../onboarding-video-core/resources/shot-planning.md) — intake checklist, focal-element selection, timeline sketching
4. [../onboarding-video-core/resources/crop-techniques.md](../onboarding-video-core/resources/crop-techniques.md) — clip-path, overflow-hidden wrappers, presented-container wrapper, layered backgrounds, shared-element transitions
5. [../onboarding-video-core/resources/top-caption.md](../onboarding-video-core/resources/top-caption.md) — drop-in `TopCaption` component (electron defaults: 44px / maxW 960 / topOffset 60 / letter-spacing -1; mixed-weight emphasis)
6. [../onboarding-video-core/resources/pointer-cursor.md](../onboarding-video-core/resources/pointer-cursor.md) — drop-in `Pointer` component (mouse arrow + ripple). For electron at 1280×720, use `scale={1.3}` so the cursor reads at the tighter canvas. Layer pre-click glow + cursor depression + second ring for premium feel.
7. [../onboarding-video-core/resources/platform-defaults.md](../onboarding-video-core/resources/platform-defaults.md) — quick-reference table for dimensions, fonts, paths

## Electron-specific workflow

### 1. Detect the project layout

Electron projects following the AgentCanvas pattern have:

- A separate `remotion/` package with its own `package.json`, run via `pnpm run studio` from inside `remotion/`
- `remotion/src/Root.tsx` registers compositions
- Renders output to `<project>/src/renderer/public/tutorials/<id>.mp4`
- Each tutorial registered in `<project>/src/renderer/data/tutorials.ts` with `id`, `category`, `title`, `description`, `media`
- `remotion/package.json` has a `render:<id>` script per tutorial pointing at the renderer path

If the project doesn't follow this pattern, ask the user how they wire tutorial videos into the app before adding new compositions.

### 2. Intake — getting stills

Electron projects have to capture stills *of the running app*. Two approaches:

**Option A — user supplies them.** Default. Ask for 2–4 stills per screen via `AskUserQuestion`. Save to `remotion/public/<feature>/<state>.png`.

**Option B — capture from the running Electron app.** If the user has the app running and wants you to grab states:
- macOS: `screencapture -i <path>` for an interactive region grab (user drags the box).
- Or use the OS screenshot tool (Cmd-Shift-4 on macOS) and have the user drop the file in.
- Avoid trying to drive the running Electron app via `agent-browser` — it doesn't expose a CDP endpoint by default and capturing the renderer process from outside is fragile.

### 3. Plan the shots

Follow [shot-planning.md](../onboarding-video-core/resources/shot-planning.md). Electron-specific:

- Tutorials tolerate slightly longer videos (up to ~45s) because they're watched in a learning context, not scrolled past.
- Match the app's palette exactly. AgentCanvas exports a `theme` object from `remotion/src/theme.ts` — read it and use those colors as your background tints. If the project doesn't have a theme export, look for the renderer's CSS variables / Tailwind config and mirror them in a local constants file.
- Caption font defaults to the macOS native stack (`-apple-system, BlinkMacSystemFont, ...`) so the video feels visually continuous with the app.

### 4. Build with Remotion

**Always invoke the `remotion-best-practices` skill before writing Remotion code.** Include this guidance in your prompt to it:

> Build a short in-app tutorial video for an Electron desktop app that has to look like it shipped inside Linear's onboarding or Raycast's first-launch flow — material identity, depth, considered pacing. Not a Remotion default.
>
> **Pieces, not screens.** Each beat shows one *piece of the feature in action*: an isolated/cropped/masked UI component animating through the interaction. The rest of the chrome is omitted. If you catch yourself rendering a full screen, crop down.
>
> **Every focal slice gets a presented container** — `borderRadius: 16, overflow: hidden, boxShadow: '0 30px 80px rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)'`. Tutorials inside the app should feel like the app gained a feature, not like a video was pasted in. The shadow + faint border defines the slice without competing.
>
> **Match the app palette exactly** (read `theme.ts` if it exists for the AgentCanvas pattern), then compose a layered background on top of it: base color + mesh gradient (2-3 large blurred radial blobs of theme-related hues at ≤0.25 opacity) + ambient light blob behind/above the focal slice (~0.4 opacity in `theme.accent`, blurred 80-120px, drifting ~40px over 8s) + vignette (`radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.35) 100%)`). Pure `#fff` or `#000` are forbidden.
>
> **Hero beat: exactly one per video.** The money shot. Slower focal motion (~20%), 6-10 frames of breathing room before action, 12-18 frames held still on the result, accent glow on the focal slice container in `theme.accent` at ~0.3 opacity.
>
> **Vary easings within each beat.** Workhorse `Easing.bezier(0.16, 1, 0.3, 1)` for fades; `Easing.bezier(0.34, 1.56, 0.64, 1)` for elements that pop in with slight overshoot; `Easing.bezier(0.83, 0, 0.17, 1)` for hero reveals. Anticipation pull-backs (2-4 frames) before forward motion and settle overshoots (6-10 frames) after fast moves add weight. Same-easing-everywhere is the #1 amateur tell.
>
> **Spring-based motion, masked reveals via `clip-path`, shared-element transitions between adjacent beats** (animate position/scale of the source slice into the target's, don't pop). Crossfades via `<TransitionSeries>` with `linearTiming({ durationInFrames: 12-18 })`. **Never fade-to-black** between beats.
>
> **Cursor leads every click with the full feedback stack:** pre-click hover glow (4-6 frames before the click, soft radial highlight on target at ~0.2 opacity), cursor depression on click (scale 1.0 → 0.92 → 1.0 over 9 frames), multi-ring ripple (two concentric rings staggered by 4 frames), optional target depression. At 1280×720 use `scale={1.3}` on the Pointer so the cursor reads. Cursor fades in at the focal area center — never enters from off-frame.
>
> **Captions: 5-7 words max, weight 500 with the meaning-carrying noun in weight 800 (`<strong>`), letter-spacing -1 at 44px (never -0.5).** Use the `TopCaption` component with `children` for mixed-weight emphasis.
>
> **Animate the actual content that proves the feature works** — typewriter per-character reveal at 50-90ms with blinking caret for typing; counter rolls over 30-45 frames for stat reveals; staggered spring-in (8-12 frame stagger) for list/result reveals. Tutorials about real features need to *show the feature happening*, not just label it.
>
> Each beat 90–240 frames at 30fps; tutorials tolerate slightly longer videos because they're watched intentionally. Stills go in `remotion/public/<feature>/<state>.png` and load via `staticFile()`. Use the macOS native font stack so the video feels native to the app. Default canvas 1280×720 — expose width/height as props in case the user wants a hi-res variant later. **Before showing the user the draft, run the 11-question QA pass from `production-quality.md`.**

Project conventions to follow (AgentCanvas pattern):

- One `<Composition>` per tutorial in `remotion/src/Root.tsx`. Composition `id` matches the tutorial id used in `tutorials.ts` (capitalized, e.g. `Welcome`, `SpawnTerminal`).
- Scene components in `remotion/src/scenes/<TutorialName>/` (one folder per tutorial, with one file per beat) — match the AgentCanvas Welcome.tsx orchestration pattern.
- Helper modules: keep `kinetic.ts`-style helpers (springAt, blurResolve, wipeReveal) in `remotion/src/`. Reuse them, don't duplicate.
- `TopCaption.tsx` and `Pointer.tsx` go in `remotion/src/components/`.

### 5. Wire the tutorial into the app

After the Remotion composition exists, three small edits land it in the app:

**a. `remotion/package.json`** — add render scripts:

```json
"scripts": {
  "render:<id>": "remotion render src/index.ts <CompositionId> ../src/renderer/public/tutorials/<id>.mp4",
  "render:<id>:poster": "remotion still src/index.ts <CompositionId> ../src/renderer/public/tutorials/<id>.jpg --frame=30"
}
```

**b. `<project>/src/renderer/data/tutorials.ts`** — add a `Tutorial` entry:

```ts
{
  id: '<id>',
  category: '<getting-started | terminals | browser | ...>',
  title: '<Display title>',
  description: '<One-line description>',
  media: {
    type: 'video',
    src: '/tutorials/<id>.mp4?v=1',          // bump ?v=N when re-rendering — Electron caches mp4 URLs
    posterSrc: '/tutorials/<id>.jpg?v=1',
    durationSec: <video length>,
  },
  tags: ['...'],
  publishedAt: '<YYYY-MM-DD>',
  status: 'live',
}
```

**c. Render** — `cd remotion && pnpm run render:<id> && pnpm run render:<id>:poster`

Then bump the `?v=N` cache-bust on every re-render. **Do not skip this.** Electron's Chromium caches mp4 URLs hard and will play stale videos otherwise.

### 6. Iterate

Studio for live preview during development:

```bash
cd remotion && pnpm run studio
```

Run a draft render, drop it in via the `tutorials.ts` registration, launch the app, and ask the user for per-beat feedback inside the actual tutorial overlay where it'll live.

## Electron-specific gotchas

- **Cache busting is mandatory.** Bump `?v=N` on every re-render. Forgetting this is the most common confusion ("but I re-rendered it").
- **Match the app palette.** Read `theme.ts` (or the renderer's design tokens) and reuse those colors. Anything off-palette breaks the feeling that the tutorial belongs inside the app.
- **Native font stack only.** Don't load Google Fonts unless the app itself does. `-apple-system` on macOS gives the right native feel.
- **Cursor scale matters.** At 1280×720 the default `scale={1}` cursor is too small; bump to 1.3 so it reads at the tighter canvas.
- **Tutorial videos can be longer than other onboarding videos** (45s tolerable) because they're watched intentionally, not scrolled past. Still keep beats short — long beats just bore.

## When in doubt

Ask. A 10-second clarifying question saves a 2-minute render that misses the point.

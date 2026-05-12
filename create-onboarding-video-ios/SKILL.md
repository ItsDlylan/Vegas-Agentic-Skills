---
name: create-onboarding-video-ios
description: Produce short, punchy iOS app onboarding videos in Remotion that showcase a feature in action by animating isolated pieces of the UI (cropped components, not full screens) with finger-tap touch indicators and nice UI-like transitions. Use when the user asks to create, build, or generate an onboarding video, app preview, App Store preview, or any short video that demonstrates an iOS app feature using supplied screenshots.
---

# Create Onboarding Video — iOS

The iOS variant of the onboarding video skill. Designed for App Store previews, in-app onboarding sheets, and social clips that demo iOS features. **Touch disc indicates taps** (not a mouse cursor — iOS uses a translucent circle, the App Preview convention). Default canvas is **1080×1920 (9:16 portrait)**.

## Read these first

The platform-neutral rules and component specs live in the shared core. **Read them in order** before writing any composition:

1. [../onboarding-video-core/resources/core-rules.md](../onboarding-video-core/resources/core-rules.md) — what you make, the pieces-not-screens rule, hero beat, captions, indicator motion, motion vocabulary, forbidden moves
2. [../onboarding-video-core/resources/production-quality.md](../onboarding-video-core/resources/production-quality.md) — **the bar.** Reference standards, material identity, presented containers, motion variety, premium tap feedback, content animations, QA pass, anti-tells of "elementary." Read this *before* sketching shots, not after rendering.
3. [../onboarding-video-core/resources/shot-planning.md](../onboarding-video-core/resources/shot-planning.md) — intake checklist, focal-element selection, timeline sketching
4. [../onboarding-video-core/resources/crop-techniques.md](../onboarding-video-core/resources/crop-techniques.md) — clip-path, overflow-hidden wrappers, presented-container wrapper, layered backgrounds, shared-element transitions
5. [../onboarding-video-core/resources/top-caption.md](../onboarding-video-core/resources/top-caption.md) — drop-in `TopCaption` component (iOS defaults: 54px / maxW 880 / topOffset 100 / letter-spacing -1.5; mixed-weight emphasis)
6. [../onboarding-video-core/resources/touch-indicator.md](../onboarding-video-core/resources/touch-indicator.md) — drop-in `TouchIndicator` component (translucent disc + tap pulse). Layer pre-tap glow + second expanding ring for premium feel.
7. [../onboarding-video-core/resources/platform-defaults.md](../onboarding-video-core/resources/platform-defaults.md) — quick-reference table for dimensions, fonts, paths

## iOS-specific workflow

### 1. Detect the project

iOS onboarding videos are usually built in a standalone Remotion project (the iOS app itself doesn't need a `remotion/` directory — the video output ships as a baked MP4 either inside the iOS bundle or as an App Store Preview upload).

If the user is in a Remotion project, use that. If not, ask where they want the project created. Don't bootstrap silently.

### 2. Intake — getting stills

iOS stills are simulator screenshots. Required:

- 2–4 stills per screen at the iOS device's native resolution (e.g. iPhone 15 Pro: 1179×2556).
- Take from the **iOS Simulator** (`Device → Trigger Screenshot` or `⌘S`). Do not use real-device screenshots — they include status bar content that varies and Dynamic Island artefacts.
- Prefer captures at 3x scale (the simulator default) and let Remotion downscale to the canvas width. Sharper.

For each screen ask via `AskUserQuestion`:
- resting state
- mid-interaction (button pressed, sheet halfway, etc.)
- result state
- optional variant (empty/filled, light/dark)

Save to `public/<screen-name>/<state>.png`.

### 3. Plan the shots

Follow [shot-planning.md](../onboarding-video-core/resources/shot-planning.md). iOS-specific:

- Default canvas **1080×1920 portrait** (9:16). For App Store Preview uploads, render at the device-specific portrait sizes Apple requires (1080×1920 covers most), or render at native device resolution if the user is targeting a specific submission size.
- Background: tinted brand color is the cleanest look. Heavily-blurred copy of the same still works for richer apps. **Never** show the full status bar / home indicator unless explicitly asked — they fight the focal element for attention.
- Use the iOS-native font stack so the caption feels native: `'-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif'`.

### 4. Build with Remotion

**Always invoke the `remotion-best-practices` skill before writing Remotion code.** Include this guidance in your prompt to it:

> Build a short iOS-app onboarding video that has to clear the bar of a top-quartile App Store Preview — Linear-grade typography, App-Store-Preview tap feedback, material identity. Not a Remotion default.
>
> **Pieces, not screens.** Each beat shows one *piece of the feature in action*: an isolated/cropped/masked UI component (button, card, row, sheet, field, chart) animating through the interaction that demonstrates what the feature does. The rest of the app chrome is omitted. Never show the device frame, notch, or status bar unless explicitly asked — implied chrome reads stronger than rendered chrome.
>
> **Every focal slice gets a presented container** — `borderRadius: 16, overflow: hidden, boxShadow: '0 30px 80px rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)'`. Slices floating naked on the background read as cutouts.
>
> **Layered background, never flat color.** Compose base color (brand-tinted) + mesh gradient (2-3 large blurred radial blobs of related brand hues at ≤0.25 opacity) + ambient light blob behind/above the focal slice (~0.4 opacity in brand accent, blurred 80-120px, drifting ~40px over 8s) + vignette (`radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.35) 100%)`). For richer apps, add a heavily-blurred copy of the still at ~0.35 opacity behind everything. Pure `#fff` or `#000` are forbidden.
>
> **Hero beat: exactly one per video.** The money shot — the moment that delivers the feature's promise. Slower focal motion (~20%), 6-10 frames of breathing room before action, 12-18 frames held still on the result, accent glow on the focal slice container in brand accent at ~0.3 opacity.
>
> **Vary easings within each beat.** Workhorse `Easing.bezier(0.16, 1, 0.3, 1)` for fades; `Easing.bezier(0.34, 1.56, 0.64, 1)` for elements that pop in with slight overshoot; `Easing.bezier(0.83, 0, 0.17, 1)` for hero reveals. Anticipation pull-backs (2-4 frames) before forward motion and settle overshoots (6-10 frames) after fast moves. Same-easing-everywhere is the #1 amateur tell.
>
> **Spring-based motion, masked reveals via `clip-path`, shared-element transitions between adjacent beats** (animate position/scale of the source slice into the target's, don't pop). Crossfades via `<TransitionSeries>` with `linearTiming({ durationInFrames: 12-18 })`. **Never fade-to-black** between beats.
>
> **Touch disc, not a finger or hand illustration. Full tap feedback stack:** pre-tap glow (4-6 frames before tap, soft radial highlight at ~0.22 opacity), disc compression (1.0 → 0.78 → 1.0), multi-ring expansion (two concentric rings staggered by 4 frames), optional target depression. Disc fades in at the focal area center — never enters from off-frame. Default disc 88px at 1080-wide; semi-translucent white, never pure white.
>
> **Captions: 5-7 words max, weight 500 with the meaning-carrying noun in weight 800 (`<strong>`), letter-spacing -1.5 at 54px (never -0.5).** Use the `TopCaption` component with `children` for mixed-weight emphasis. Consider left-aligning the caption when the focal slice sits off-axis.
>
> **Animate the actual content that proves the feature works** — typewriter per-character reveal at 50-90ms with blinking caret for typing; counter rolls over 30-45 frames for stat reveals; staggered spring-in (8-12 frame stagger between rows) for list/result reveals. Static "data appears instantly" undersells the feature.
>
> Each beat 90–180 frames at 30fps. Stills go in `public/<screen>/<state>.png` and load via `staticFile()`. Use the iOS-native font stack (`-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif`). Default canvas 1080×1920; expose width/height as props so the same scenes can render landscape if asked. **Before showing the user the draft, run the 11-question QA pass from `production-quality.md`.**

Project conventions:

- One `<Composition>` per onboarding flow in `src/Root.tsx`.
- One `<Sequence>` (or `<TransitionSeries.Sequence>`) per beat.
- Components in `src/scenes/<flow-name>/`, shared transitions/helpers in `src/transitions/` and `src/components/`.
- `TopCaption.tsx` and `TouchIndicator.tsx` go in `src/components/`.

### 5. Render and iterate

```bash
npx remotion studio              # Live preview
npx remotion render src/index.ts <FlowId> out/<flow>.mp4 --jpeg-quality=70   # Draft
npx remotion still  src/index.ts <BeatId> out/<beat>-frame.png --frame=60     # Per-beat sanity still
```

Show the draft to the user. Ask **per-beat** what to change. Treat the first render as a draft.

For App Store Preview submission, after sign-off, render the final at the spec Apple requires for the target devices (the user will tell you, or look up `https://developer.apple.com/help/app-store-connect/reference/app-preview-specifications`).

## iOS-specific gotchas

- **Touch disc, not a hand or finger illustration.** The translucent circle is the convention; literal hands look amateur. See [touch-indicator.md](../onboarding-video-core/resources/touch-indicator.md).
- **Indicator size matters at 1080×1920.** Default 88px disc is calibrated to feel like a real iOS tap affordance. Adjust per focal element size.
- **Don't show the device frame** (notch, bezel, status bar) unless the user explicitly asks. Implied chrome reads stronger than rendered chrome.
- **Match the app's design language exactly.** Use the colors, corner radii, and type from the supplied stills. Don't restyle them.
- **App Store Preview submission specs change.** Don't hardcode dimensions for final submissions — ask the user for the target device size before final render.

## When in doubt

Ask. A 10-second clarifying question saves a 2-minute render that misses the point.

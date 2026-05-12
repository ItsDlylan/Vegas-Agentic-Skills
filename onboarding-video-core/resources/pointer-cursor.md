# Pointer cursor — drop-in component for web & electron

Mouse-cursor indicator for `click` interactions in web and electron onboarding videos. **iOS uses [touch-indicator.md](./touch-indicator.md) instead** — fingers, not arrows.

## Rules recap (see core-rules.md for full context)

- Cursor leads every click. Click ripple alone is not enough.
- Fades in at the visual center of the focal area. Never enters from off-frame.
- One single straight move (any direction including diagonal) to the target.
- Multiple clicks on the same UI: cursor stays visible and glides between targets in continuous straight segments. No reset between clicks on the same UI.
- Different UI / new screen: cursor fades out + back in at center for the next interaction.

## Component

```tsx
// src/components/Pointer.tsx
import React from 'react'
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

const FADE_FRAMES = 8
const MOVE_EASE = Easing.bezier(0.16, 1, 0.3, 1)
const RIPPLE_FRAMES = 18

export interface PointerHop {
  /** Pixel coordinates of the target on the composition canvas */
  x: number
  y: number
  /** Frames to spend gliding from the previous position to this one */
  travelFrames: number
  /** Frames to dwell on this target after arriving (before the click ripple resolves) */
  dwellFrames: number
  /** Whether to fire a click ripple when arriving here. Default true. */
  click?: boolean
}

export interface PointerProps {
  /** Where the cursor materialises. Should be the visual center of the focal area. */
  origin: { x: number; y: number }
  /** Sequence of straight-line hops to interaction targets. */
  hops: PointerHop[]
  /** When this beat begins (relative to the parent Sequence). Default 0. */
  startFrame?: number
  /** Whether to fade out at the end (true when the next interaction is on different UI). */
  fadeOutAtEnd?: boolean
  /** Cursor color override. Default white with subtle drop-shadow. */
  color?: string
  /** Cursor scale. 1.0 = ~36px tall. */
  scale?: number
}

export const Pointer: React.FC<PointerProps> = ({
  origin,
  hops,
  startFrame = 0,
  fadeOutAtEnd = false,
  color = '#ffffff',
  scale = 1,
}) => {
  const frame = useCurrentFrame()
  const local = frame - startFrame

  // Fade in at origin
  const fadeIn = interpolate(local, [0, FADE_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Walk through hops, computing current position + active ripple
  let cursorX = origin.x
  let cursorY = origin.y
  let segmentStart = FADE_FRAMES
  let activeRipple: { startedAt: number; x: number; y: number } | null = null

  for (let i = 0; i < hops.length; i++) {
    const hop = hops[i]
    const travelEnd = segmentStart + hop.travelFrames
    const dwellEnd = travelEnd + hop.dwellFrames

    if (local >= segmentStart && local < travelEnd) {
      const t = interpolate(local, [segmentStart, travelEnd], [0, 1], {
        easing: MOVE_EASE,
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
      cursorX = interpolate(t, [0, 1], [cursorX, hop.x])
      cursorY = interpolate(t, [0, 1], [cursorY, hop.y])
      break
    }

    cursorX = hop.x
    cursorY = hop.y

    if (local >= travelEnd && local < dwellEnd && hop.click !== false) {
      activeRipple = { startedAt: travelEnd, x: hop.x, y: hop.y }
      break
    }

    if (local >= dwellEnd && i === hops.length - 1) {
      activeRipple =
        hop.click === false
          ? null
          : { startedAt: travelEnd, x: hop.x, y: hop.y }
    }

    segmentStart = dwellEnd
  }

  // Fade out at very end if asked
  let fadeOut = 1
  if (fadeOutAtEnd) {
    const lastHopEnd =
      FADE_FRAMES +
      hops.reduce((acc, h) => acc + h.travelFrames + h.dwellFrames, 0)
    fadeOut = interpolate(local, [lastHopEnd, lastHopEnd + FADE_FRAMES], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  }

  const opacity = Math.min(fadeIn, fadeOut)

  return (
    <>
      {activeRipple && (
        <Ripple
          x={activeRipple.x}
          y={activeRipple.y}
          startedAt={activeRipple.startedAt}
          local={local}
          color={color}
        />
      )}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `translate(${cursorX}px, ${cursorY}px) scale(${scale})`,
          transformOrigin: '0 0',
          opacity,
          pointerEvents: 'none',
          willChange: 'transform, opacity',
          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.35))',
        }}
      >
        {/* macOS-ish arrow */}
        <svg width="36" height="42" viewBox="0 0 36 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M2 2 L2 32 L10 24 L15 36 L20 33 L15 22 L26 22 Z"
            fill={color}
            stroke="#000"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </>
  )
}

const Ripple: React.FC<{ x: number; y: number; startedAt: number; local: number; color: string }> = ({
  x,
  y,
  startedAt,
  local,
  color,
}) => {
  const t = interpolate(local, [startedAt, startedAt + RIPPLE_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const scale = interpolate(t, [0, 1], [0, 2.4])
  const opacity = interpolate(t, [0, 0.2, 1], [0, 0.55, 0])

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        transform: `translate(${x - 36}px, ${y - 36}px) scale(${scale})`,
        width: 72,
        height: 72,
        borderRadius: '50%',
        border: `2px solid ${color}`,
        opacity,
        pointerEvents: 'none',
      }}
    />
  )
}
```

## Usage

### Single click — interactive beat

```tsx
const SLICE_CENTER = { x: 540, y: 960 }
const BUTTON_TARGET = { x: 800, y: 1180 }

<Pointer
  origin={SLICE_CENTER}
  hops={[
    { x: BUTTON_TARGET.x, y: BUTTON_TARGET.y, travelFrames: 22, dwellFrames: 18 },
  ]}
  fadeOutAtEnd={true}  // next beat is on a different screen
/>
```

### Multiple clicks on the same UI — keep cursor visible

```tsx
<Pointer
  origin={SLICE_CENTER}
  hops={[
    { x: SEGMENT_TARGET.x, y: SEGMENT_TARGET.y, travelFrames: 18, dwellFrames: 14 },
    { x: BUTTON_TARGET.x,  y: BUTTON_TARGET.y,  travelFrames: 16, dwellFrames: 18 },
  ]}
  fadeOutAtEnd={false}  // staying on the same UI; let next beat's continuation handle it
/>
```

### Continuation across beats on the same UI

If beat 2 continues from beat 1 on the same UI, render a Pointer in beat 2 with `origin` set to beat 1's last hop position and `startFrame` set so it doesn't fade in (skip the entry by setting `startFrame: -FADE_FRAMES`). Or, simpler: lift the Pointer out of either beat and render it at the parent flow level so it persists naturally.

## Tuning

- **`travelFrames`** — 16–24 for a typical click-target glide. Faster feels rushed; slower feels lazy.
- **`dwellFrames`** — 14–22 to let the click ripple resolve and the result animate in.
- **`scale`** — 1.2–1.4 for high-density desktop UIs (electron tutorials at 1280×720) so the cursor reads at small sizes; 1.0 for portrait web at 1080×1920.

## Premium click feedback — what Tella / Screen Studio do

The component above ships with the single-ring ripple as a floor. For premium feel, layer the rest of the click feedback stack. A single weak ring with no cursor reaction is the most reliable amateur tell after flat backgrounds and naked focal slices.

The full stack at every click:

1. **Pre-click hover glow** (4–6 frames *before* the click). A soft radial highlight materialises under the cursor on the target — `~12px blur, brand accent at 0.2 opacity, 80×80px`. Tells the viewer "about to click here." Render it as a sibling of the cursor, with its position locked to the hop target and its opacity gated by `frame >= travelEnd - 6 && frame < travelEnd`.
2. **Cursor depression** (at the click frame). Cursor scales 1.0 → 0.92 over 3 frames, recovers to 1.0 over 6 frames. Mimics finger pressure. Compose this into the `scale` value in the cursor transform.
3. **Multi-ring ripple** (compound feel). Two concentric rings, staggered by 4 frames:
   - Ring 1: scale 0 → 2.4 over 18 frames, opacity 0 → 0.55 → 0
   - Ring 2: scale 0 → 1.6 over 14 frames, opacity 0 → 0.35 → 0 (starts 4 frames later)
   The component currently renders Ring 1. Add Ring 2 by duplicating the `<Ripple>` JSX with `startedAt: activeRipple.startedAt + 4`, `RIPPLE_FRAMES = 14`, and tuned scale/opacity values.
4. **Target depression** (optional, for buttons). At the click frame, the button itself dips brightness ~6% and scales ~0.98 for 2–3 frames. Implement as a 2-3 frame animation on the button slice keyed to the same `travelEnd` frame as the ripple.

For most beats, items 2 + 3 + 4 are enough. Add item 1 on the hero beat.

## Cursor SVG — match the OS feel

The default arrow path is the macOS shape. Two refinements that read more premium:

- **Subtle gradient fill** instead of pure white. `fill: url(#cursorGradient)` with a top-light, bottom-shadow gradient (white → `#dcdcdc`). Reads as material instead of vector.
- **Soft shadow already wired** via `filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.35))'`. Don't remove it; the cursor needs to feel lifted off the slice.

## Don'ts

- Do not bend the path with intermediate keyframes between hops. Each hop is a single straight segment.
- Do not enter from off-screen. `origin` must be inside the focal area.
- Do not fade out + back in between hops on the same UI. Use multiple hops in one Pointer instance.
- Do not ship a click with only a single-ring ripple. Layer cursor depression at minimum; add the second ring and pre-click glow for premium beats.
- Do not draw a literal cursor "skin" with a hand or finger — the arrow shape is universal.

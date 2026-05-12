# Touch indicator — drop-in component for iOS

Finger-tap indicator for `tap` interactions in iOS onboarding videos. Web/electron use [pointer-cursor.md](./pointer-cursor.md) (mouse arrow) instead.

A touch indicator is a translucent disc — what you see in iOS App Preview videos — not a literal hand or finger illustration. Hands look amateur; the disc reads as universal "touch lands here."

## Rules recap (see core-rules.md for full context)

Same motion grammar as the mouse pointer:

- Fades in at the visual center of the focal area. Never enters from off-frame.
- One straight glide (any direction including diagonal) to the target.
- Multiple taps on the same UI: indicator stays visible and glides between targets in continuous straight segments.
- Different UI / new screen: indicator fades out + back in at center.

## Component

```tsx
// src/components/TouchIndicator.tsx
import React from 'react'
import { Easing, interpolate, useCurrentFrame } from 'remotion'

const FADE_FRAMES = 8
const MOVE_EASE = Easing.bezier(0.16, 1, 0.3, 1)
const TAP_FRAMES = 14

export interface TouchHop {
  x: number
  y: number
  travelFrames: number
  dwellFrames: number
  tap?: boolean
}

export interface TouchIndicatorProps {
  origin: { x: number; y: number }
  hops: TouchHop[]
  startFrame?: number
  fadeOutAtEnd?: boolean
  /** Disc diameter in px. Default 88px (matches iOS finger-press affordance at 1080-wide). */
  size?: number
  color?: string
}

export const TouchIndicator: React.FC<TouchIndicatorProps> = ({
  origin,
  hops,
  startFrame = 0,
  fadeOutAtEnd = false,
  size = 88,
  color = 'rgba(255, 255, 255, 0.85)',
}) => {
  const frame = useCurrentFrame()
  const local = frame - startFrame
  const radius = size / 2

  const fadeIn = interpolate(local, [0, FADE_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  let x = origin.x
  let y = origin.y
  let segmentStart = FADE_FRAMES
  let activeTap: { startedAt: number; x: number; y: number } | null = null

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
      x = interpolate(t, [0, 1], [x, hop.x])
      y = interpolate(t, [0, 1], [y, hop.y])
      break
    }

    x = hop.x
    y = hop.y

    if (local >= travelEnd && local < dwellEnd && hop.tap !== false) {
      activeTap = { startedAt: travelEnd, x, y }
      break
    }

    segmentStart = dwellEnd
  }

  let fadeOut = 1
  if (fadeOutAtEnd) {
    const lastHopEnd =
      FADE_FRAMES + hops.reduce((acc, h) => acc + h.travelFrames + h.dwellFrames, 0)
    fadeOut = interpolate(local, [lastHopEnd, lastHopEnd + FADE_FRAMES], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  }

  const opacity = Math.min(fadeIn, fadeOut)

  // Tap reaction: disc briefly shrinks + a soft outer ring pulses
  let tapScale = 1
  let ringScale = 1
  let ringOpacity = 0
  if (activeTap) {
    const t = interpolate(local, [activeTap.startedAt, activeTap.startedAt + TAP_FRAMES], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
    tapScale = interpolate(t, [0, 0.4, 1], [1, 0.78, 1])
    ringScale = interpolate(t, [0, 1], [1, 2.2])
    ringOpacity = interpolate(t, [0, 0.15, 1], [0, 0.5, 0])
  }

  return (
    <>
      {activeTap && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transform: `translate(${activeTap.x - radius}px, ${activeTap.y - radius}px) scale(${ringScale})`,
            width: size,
            height: size,
            borderRadius: '50%',
            border: `3px solid ${color}`,
            opacity: ringOpacity,
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `translate(${x - radius}px, ${y - radius}px) scale(${tapScale})`,
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: color,
          mixBlendMode: 'screen',
          opacity,
          pointerEvents: 'none',
          willChange: 'transform, opacity',
          boxShadow: '0 4px 24px rgba(0,0,0,0.35), inset 0 0 0 2px rgba(255,255,255,0.4)',
        }}
      />
    </>
  )
}
```

## Usage

### Single tap — interactive beat

```tsx
const SLICE_CENTER = { x: 540, y: 960 }
const BUTTON_TARGET = { x: 540, y: 1380 }  // diagonal would also be fine

<TouchIndicator
  origin={SLICE_CENTER}
  hops={[
    { x: BUTTON_TARGET.x, y: BUTTON_TARGET.y, travelFrames: 22, dwellFrames: 18 },
  ]}
  fadeOutAtEnd={true}
/>
```

### Multiple taps on the same form — finger stays visible, glides between targets

```tsx
<TouchIndicator
  origin={SLICE_CENTER}
  hops={[
    { x: SEGMENT_TARGET.x, y: SEGMENT_TARGET.y, travelFrames: 18, dwellFrames: 14 },
    { x: SUBMIT_TARGET.x,  y: SUBMIT_TARGET.y,  travelFrames: 18, dwellFrames: 18 },
  ]}
  fadeOutAtEnd={true}
/>
```

## Tuning

- **`size`** — 88 at 1080-wide is a good iOS-feeling tap affordance. Bump to 100 for very large touch targets, drop to 76 for compact controls.
- **`travelFrames`** — 18–26 for finger glides; touch feels heavier than mouse, so slightly slower than the cursor.
- **`color`** — keep semi-translucent. Pure white discs read as bugs.

## Premium tap feedback — what App Store Preview top hits do

The component above ships with the disc compression (1 → 0.78 → 1) and the single expanding ring as a floor. For premium feel, layer:

1. **Pre-tap glow** (4–6 frames before the tap). A soft radial highlight materialises under the disc at the hop target — `~16px blur, brand accent at 0.22 opacity, 100×100px`. Tells the viewer "about to tap here." Gate visibility by `local >= travelEnd - 6 && local < travelEnd`.
2. **Multi-ring expansion** (compound feel). Two concentric rings, staggered by 4 frames:
   - Ring 1 (the existing ring): scale 1 → 2.2, opacity 0 → 0.5 → 0 over 14 frames.
   - Ring 2: scale 1 → 1.5, opacity 0 → 0.32 → 0 over 10 frames, starting 4 frames after ring 1.
   Duplicate the existing `<div>` ring with a staggered `startedAt` and tighter scale/opacity values.
3. **Target depression** (optional, for buttons). At the tap frame, the button slice itself dips brightness ~6% and scales ~0.98 for 2–3 frames, paired with the ring expansion.

For most beats, the existing disc compression + ring 1 + item 3 is enough. Add the pre-tap glow and ring 2 on the hero beat.

## Don'ts

- Don't render a literal hand or finger illustration. The disc is the convention.
- Don't tap from off-screen. `origin` is the visual center of the focal area.
- Don't reset between taps on the same form. One TouchIndicator instance, multiple hops.
- Don't ship a tap with only the disc and no expanding ring. The ring is part of the floor.
- Don't use pure white discs. Keep semi-translucent so they read as "touch" not "bug."

# TopCaption — drop-in caption component

The single source of truth for caption rendering. Use this everywhere; do not position captions inline per scene.

## Rules recap (see core-rules.md for full context)

- Anchored top-of-frame, fixed position across every beat (~100px from top, horizontally centered by default — see "Composed alignment" below for off-center cases).
- Reserve a ~200–240px caption band; lay focal UI below it.
- Rises in from ~60px below rest with `opacity: 0`, slides up + fades in over 12 frames using `Easing.bezier(0.16, 1, 0.3, 1)`.
- Visible the entire beat. Never delay entry. Never fade out before the beat ends.
- 54px+ / weight 700 / `maxWidth` so long lines wrap, with display-grade `letter-spacing` (see below).
- Same caption text across consecutive beats → use `staticEntry` on continuation beats so the caption reads as persistent across the cut.

## Writing the caption — what makes it premium vs. amateur

- **5–7 word limit per caption.** If the line wraps to 3 lines, rewrite tighter. Headlines, not subtitles. "Search across every binder, in milliseconds" is too long; "Search every binder instantly" lands.
- **Title Case for headlines** ("Search Every Binder Instantly") *or* sentence case throughout ("Search every binder instantly"). Pick one for the video and stay consistent. Never ALL CAPS unless the brand uses it.
- **Mixed weight for emphasis.** Wrap the noun or verb that carries the meaning in weight 800 inside a weight 500 line — the eye lands on the differentiator:
  ```tsx
  <TopCaption>
    Search anything in <strong>milliseconds</strong>
  </TopCaption>
  ```
  (Style `strong` inline or via a child span; the `TopCaption` component below supports `children` as well as `text` for this.)
- **Optional muted subtitle.** A 20–24px line in 40% opacity below the headline, when the headline needs context. Use sparingly — usually the caption stands alone.

## Component

```tsx
// src/components/TopCaption.tsx
import React from 'react'
import { Easing, interpolate, useCurrentFrame } from 'remotion'

const RISE_DISTANCE = 60       // px the caption travels upward into rest position
const ENTRY_DURATION = 12      // frames to rise + fade in
const ENTRY_EASE = Easing.bezier(0.16, 1, 0.3, 1)

export interface TopCaptionProps {
  /** Plain text caption. Use `children` instead if you need mixed-weight emphasis. */
  text?: string
  /** For mixed-weight captions: pass JSX with <strong> around the emphasised word(s). */
  children?: React.ReactNode
  /** Use 'static' on continuation beats that share the EXACT same text as the prior beat. */
  entry?: 'rise' | 'static'
  /** Optional muted subtitle below the headline (20-24px, 40% opacity). Use sparingly. */
  subtitle?: string
  /** Override defaults for the platform you're rendering at. */
  fontSize?: number
  maxWidth?: number
  topOffset?: number
  /** Horizontal alignment within the caption band. Default 'center'; use 'flex-start' / 'flex-end' for composed off-center alignment with the focal element. */
  align?: 'flex-start' | 'center' | 'flex-end'
  textAlign?: 'left' | 'center' | 'right'
  color?: string
  fontFamily?: string
  fontWeight?: number | string
  /** Display-grade letter-spacing. Defaults to -1.5 at 54px+, scale down for smaller sizes. */
  letterSpacing?: number
}

export const TopCaption: React.FC<TopCaptionProps> = ({
  text,
  children,
  entry = 'rise',
  subtitle,
  fontSize = 54,
  maxWidth = 880,
  topOffset = 100,
  align = 'center',
  textAlign = 'center',
  color = '#ffffff',
  fontFamily = 'inherit',
  fontWeight = 500,
  letterSpacing = -1.5,
}) => {
  const frame = useCurrentFrame()

  const progress =
    entry === 'static'
      ? 1
      : interpolate(frame, [0, ENTRY_DURATION], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: ENTRY_EASE,
        })

  const translateY = (1 - progress) * RISE_DISTANCE
  const opacity = progress

  return (
    <div
      style={{
        position: 'absolute',
        top: topOffset,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: align,
        paddingInline: 80,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth,
          fontFamily,
          fontWeight,
          fontSize,
          color,
          textAlign,
          lineHeight: 1.1,
          letterSpacing,
          transform: `translateY(${translateY}px)`,
          opacity,
        }}
      >
        {children ?? text}
        {subtitle && (
          <div
            style={{
              marginTop: 12,
              fontSize: Math.round(fontSize * 0.38),
              fontWeight: 500,
              letterSpacing: -0.3,
              opacity: 0.4,
              lineHeight: 1.3,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  )
}
```

## Usage

```tsx
import { TopCaption } from '@/components/TopCaption'

// Plain caption — fresh, rises in
<TopCaption text="Tap to add it to your binder" />

// Mixed-weight emphasis — the noun "milliseconds" carries the meaning
<TopCaption>
  Search anything in <strong style={{ fontWeight: 800 }}>milliseconds</strong>
</TopCaption>

// With a muted subtitle for context (use sparingly)
<TopCaption text="Live by default" subtitle="Every edit syncs across devices in under a second" />

// SAME text as the prior beat, rendered without re-animation (persistent across the cut)
<TopCaption text="Tap to add it to your binder" entry="static" />

// Composed alignment — focal slice sits on the left, caption left-aligns to match
<TopCaption text="Drag to reorder" align="flex-start" textAlign="left" />
```

## Tuning per aspect ratio

| Canvas | fontSize | maxWidth | topOffset | letterSpacing |
|---|---|---|---|---|
| 1080×1920 portrait (iOS / social) | 54 | 880 | 100 | -1.5 |
| 1920×1080 landscape (web in-app) | 64 | 1400 | 80 | -2 |
| 1280×720 landscape (electron tutorials) | 44 | 960 | 60 | -1 |

Override via props per platform composition. `letter-spacing: -0.5` reads as "subtitle," not "headline" — never use it at 54px+.

## Composed alignment — when to break center

Center-everywhere reads as template. When the focal slice intentionally sits off-axis (left-aligned dashboard panel, right-aligned chart, etc.), align the caption to it instead. Pass `align="flex-start" textAlign="left"` (or `flex-end` / `right`) so the caption visually pairs with the focal element. Reserve this for beats where the off-axis composition is deliberate, not as a default.

## Don'ts

- Don't position the caption inline per scene. Always wrap with this component so the position stays consistent across beats.
- Don't put the caption below the focal UI.
- Don't fade the caption out mid-beat — the scene-level crossfade between beats handles the swap.
- Don't drop the caption from above. The upward rise is part of the visual identity.
- Don't use letter-spacing of `0` or `-0.5` at 54px+. Display sizes need `-1` to `-2` to read as headline-grade.
- Don't write captions over 7 words. If the line wraps to 3 lines, the caption is too long.
- Don't use the same easing on the caption rise as on the focal element entrance. Vary curves across elements within a beat.

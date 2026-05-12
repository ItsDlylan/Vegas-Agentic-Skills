# Crop techniques — extracting focal elements from a still

The skill's whole identity is "pieces of the UI, not the whole UI." This is how you actually do it in Remotion.

## Three approaches, in order of preference

### 1. CSS clip-path on `<Img>` (preferred)

Use `clip-path: inset()` on the image to crop to a region. This is the cleanest because the image stays as a single asset and you don't need to know exact pixel offsets relative to a wrapper.

```tsx
import { Img, staticFile } from 'remotion'

<Img
  src={staticFile('search-resting.png')}
  style={{
    width: 1080,
    height: 1920,
    clipPath: 'inset(240px 120px 1500px 120px round 16px)',
    // top right bottom left  — matches CSS shorthand
    // round 16px preserves the original UI's corner radius
  }}
/>
```

`inset(top right bottom left)` is the area to **clip away**, not keep. Combine with `round <radius>` to preserve the focal element's native corner radius.

### 2. Wrapper with `overflow: hidden` (when you need to scale or animate the slice)

When the slice itself needs to scale, slide, or be positioned independently, wrap the full image in a fixed-size container with `overflow: hidden` and absolutely position the image inside so the desired region lines up with the container.

```tsx
const SLICE_W = 840
const SLICE_H = 180
const ORIGIN_X = -120  // negative = pull image left so x=120 of the still aligns with container x=0
const ORIGIN_Y = -240

<div
  style={{
    width: SLICE_W,
    height: SLICE_H,
    overflow: 'hidden',
    borderRadius: 16,
    position: 'relative',
  }}
>
  <Img
    src={staticFile('search-resting.png')}
    style={{
      position: 'absolute',
      top: ORIGIN_Y,
      left: ORIGIN_X,
      width: 1080,  // original asset width
      height: 'auto',
    }}
  />
</div>
```

This pattern lets you:
- animate the slice's `transform` (translate / scale / rotate) without affecting the underlying image
- apply parallax by translating the inner image at a different rate
- swap to a different still (resting → mid → result) under the same slice frame

### 3. Pre-cropped image (only if the slice never animates internally)

If the slice is fully static (no parallax, no swap), pre-crop the image in `public/<screen>/<state>--slice.png` and load it directly. Faster to render but inflexible. Only use when you're sure.

## Presented container — wrap every focal slice

A cropped slice without depth reads as a cutout pasted on the background. Wrap every focal slice in a "presented" container before mounting it in the scene:

```tsx
// src/components/PresentedSlice.tsx — wrap every focal slice with this
const PresentedSlice: React.FC<{
  width: number
  height: number
  isHero?: boolean              // accent glow on the hero beat only
  accentColor?: string          // brand accent for the hero glow
  children: React.ReactNode
}> = ({ width, height, isHero = false, accentColor = '#3b82f6', children }) => (
  <div
    style={{
      width,
      height,
      borderRadius: 16,
      overflow: 'hidden',
      position: 'relative',
      boxShadow: [
        '0 30px 80px rgba(0,0,0,0.45)',           // soft long shadow (lift)
        '0 8px 24px rgba(0,0,0,0.25)',            // tight close shadow (contact)
        isHero ? `0 0 60px ${accentColor}4D` : '', // hero accent glow at ~30% alpha
      ].filter(Boolean).join(', '),
      border: '1px solid rgba(255,255,255,0.06)', // dark UI; use rgba(0,0,0,0.05) on light UI
    }}
  >
    {children}
    {/* Optional specular highlight along the top edge — dark UIs only */}
    <div
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 1,
        background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.12), transparent)',
        pointerEvents: 'none',
      }}
    />
  </div>
)
```

Use it on every focal slice. Set `isHero` on the single hero beat per video (see `core-rules.md` → Hero beat). Without this wrapper, slices float on the background like cutouts — the most reliable amateur tell after flat backgrounds.

## Layered background — never a flat fill

Flat tinted color reads as elementary. Compose the background with at least two of: mesh gradient, vignette, ambient light blob, subtle grain. This is the framing that makes the focal slice feel "presented" instead of plopped down.

```tsx
<AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
  {/* Mesh gradient — 2-3 large blurred blobs of related brand hues */}
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: `
        radial-gradient(60% 50% at 20% 30%, rgba(59,130,246,0.22), transparent 70%),
        radial-gradient(50% 40% at 80% 70%, rgba(168,85,247,0.18), transparent 70%)
      `,
    }}
  />

  {/* Ambient light blob behind/above the focal slice — drift slowly */}
  <div
    style={{
      position: 'absolute',
      top: '20%',
      left: '50%',
      width: 800,
      height: 800,
      borderRadius: '50%',
      background: 'rgba(59,130,246,0.4)',
      filter: 'blur(100px)',
      transform: `translate(-50%, ${interpolate(frame, [0, 240], [0, -40])}px)`,
    }}
  />

  {/* Optional: blurred whole-screen behind for depth (richer apps) */}
  <Img
    src={staticFile('search-resting.png')}
    style={{
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      filter: 'blur(60px) brightness(0.3)',
      opacity: 0.35,
    }}
  />

  {/* Vignette — pulls focus to the focal slice */}
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.35) 100%)',
      pointerEvents: 'none',
    }}
  />

  {/* Focal slice — wrapped in PresentedSlice, centered */}
  <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
    <PresentedSlice width={840} height={480} isHero={isHero}>
      <FocalSlice />
    </PresentedSlice>
  </AbsoluteFill>
</AbsoluteFill>
```

For very clean brands (Linear / Raycast aesthetic), skip the blurred-self image and rely on mesh gradient + ambient blob + vignette. For richer apps (Notion, dashboards), keep the blurred-self so the slice feels grounded in its native context. See [production-quality.md](./production-quality.md) → Material identity for full guidance.

## Shared-element transitions between slices

When the same logical UI element appears in two consecutive beats, animate from the source slice's bounding box to the target's. Don't pop. Keep both slice wrappers mounted with `position: absolute` and interpolate `top` / `left` / `width` / `height` over the transition window.

```tsx
const t = spring({ frame: frame - TRANSITION_START, fps, config: { damping: 200 } })

const top    = interpolate(t, [0, 1], [SOURCE_TOP,    TARGET_TOP])
const left   = interpolate(t, [0, 1], [SOURCE_LEFT,   TARGET_LEFT])
const width  = interpolate(t, [0, 1], [SOURCE_WIDTH,  TARGET_WIDTH])
const height = interpolate(t, [0, 1], [SOURCE_HEIGHT, TARGET_HEIGHT])
```

This is more work than a crossfade, but it's the move that makes the video feel native instead of slideshow-y.

## Anti-patterns

- **Don't** show the device chrome (browser frame, phone bezel) unless explicitly asked. Implied chrome is stronger than rendered chrome.
- **Don't** use `background-image` for the slice — Remotion's `<Img>` is required for proper preloading.
- **Don't** crop with `<canvas>` unless you have a specific reason; CSS clip-path / overflow:hidden covers 99% of cases.
- **Don't** measure pixel coordinates from a sized-down preview. Always measure from the original asset's pixel dimensions, then scale the wrapper if you need a different display size.
- **Don't** mount the focal slice without the `PresentedSlice` wrapper. A naked clip-path with no shadow reads as a cutout.
- **Don't** use a flat untinted background. At minimum: base color + mesh gradient + vignette.

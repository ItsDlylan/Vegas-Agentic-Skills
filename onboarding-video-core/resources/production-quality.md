# Production quality — the line between "elementary" and "looks paid-for"

The defaults in `core-rules.md` get you to a clean draft. This file is the bar that separates "obviously made in Remotion" from "looks like it shipped on the App Store or Linear's changelog." Treat every item below as a requirement, not aspiration. If you skip these, the video will look elementary even if every other rule is followed.

## Reference standards

Before you sketch shots, picture how the same beat would look in one of these. If you can't, the beat isn't ready:

- **Linear changelog clips** (`linear.app/changelog`) — tight crops, hero beat per feature, confident pauses, dark UI with restrained accent color, headline captions that feel composed not slapped on.
- **Raycast extension hero clips** (`raycast.com`) — single focal component per beat, soft drop-shadow on the focal slice, deep neutral background with ambient light, premium feel from negative space.
- **Stripe product launches / Sessions** — multi-beat sequences with intentional pacing; captions positioned with the focal element rather than always centered; subtle material identity (glass, depth) underneath.
- **App Store Preview top hits** — 15-second flow with the money shot in the middle 5 seconds; never feels like a tour; touch disc with refined ripple.
- **Tella / Screen Studio exports** (`screen.studio`, `tella.tv`) — cursor work as the craft signal: hover glow, depression on click, multi-ring ripple, ambient parallax background.
- **Apple iOS feature reveals** (`apple.com/ios`) — material identity: glass, depth, ambient gradients, type that breathes.

These are not "inspiration." They are the bar. Every beat must look like it could sit in any of them without standing out as cheaper.

## Material identity — backgrounds and depth

Flat tinted color is the floor; staying there is the #1 reason a video reads as elementary. Layer at least two of these onto every background:

- **Mesh gradient.** 2–3 large, blurred radial blobs of related brand hues over the base color. Each blob ≤ 0.25 opacity over the base. One blob drifts slowly (translate ~40px over 8s) so the background reads as alive, not a still.
- **Vignette.** `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.35) 100%)` over everything. Pulls focus to the focal slice without the viewer noticing it's there.
- **Ambient light.** A single bright blob behind/above the focal slice, blurred at 80–120px, ~0.4 opacity in the brand accent color. Gives the slice direction and warmth.
- **Subtle grain.** A 256×256 noise PNG at ~3% opacity over everything. Hides banding, adds material. Skip for "clean minimal" brands (Linear, Raycast); keep for richer brands (Notion, Stripe).

Pure `#ffffff` and pure `#000000` backgrounds are forbidden unless the user's brand explicitly does this — and even then, layer a vignette and an ambient blob.

## Focal slice presentation — the "presented" container

A cropped focal element must never sit naked on the background. Wrap every focal slice in a "presented" container:

```tsx
<div
  style={{
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 30px 80px rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.25)',
    border: '1px solid rgba(255,255,255,0.06)', // dark UI; use rgba(0,0,0,0.05) for light UI
    position: 'relative',
  }}
>
  {/* focal slice goes here */}
</div>
```

- **Two-layer shadow.** Soft long shadow (the lift) + tight close shadow (the contact). Single-layer shadows read as flat.
- **Faint border.** Defines the slice without competing for attention.
- **Optional specular highlight.** A 1–2px line of `rgba(255,255,255,0.12)` along the top edge, suggesting glass. Dark UIs only.
- **Optional accent glow.** Reserved for the **hero beat** (see below): an additional `box-shadow` in the brand accent color, ~60px blur, ~0.3 opacity. Use on exactly one beat per video.

## Motion — variety, not a single easing

The default `Easing.bezier(0.16, 1, 0.3, 1)` is the workhorse. Premium work mixes:

| Curve | When to use |
|---|---|
| `Easing.bezier(0.16, 1, 0.3, 1)` | Captions, cursor glides, ambient fades — the default decelerator |
| `Easing.bezier(0.34, 1.56, 0.64, 1)` | Slight overshoot — badges popping in, button confirmations |
| `Easing.bezier(0.83, 0, 0.17, 1)` | Strong ease-in-out — hero reveals, the moment the feature lands |
| `spring({ damping: 12, stiffness: 100 })` | Elastic entrances — empty state turning into populated |
| Anticipation (2–4 frame pull-back) | Before a hero animation forward; adds weight |
| Decay/settle (6–10 frame overshoot ~2–4px) | After a fast move — UI feels alive instead of mechanical |

**Within a single beat, vary easing per element.** Caption rises with one curve, focal slice with another, accent badge with a third. Same-easing-everywhere is the most reliable amateur tell.

## Hero beat — every video has exactly one

Identify the "money shot" — the moment that delivers the feature's promise. Mark it during shot planning. For that beat:

- **Breathing room.** 6–10 frames of held still before the action starts. Let the viewer arrive.
- **Slower focal motion.** ~20% slower than other beats. Pacing tells the viewer "this is the point."
- **Accent glow** on the focal slice container (see Presented container above).
- **Held still on the result.** 12–18 frames of "look at this" before the transition out.

Without a hero beat, the video reads as a sequence of equally-weighted beats and feels flat. With one, the video has a peak.

## Cursor and click feedback — the craft signal

Lazy click feedback is what makes a video look free-tier. Premium click feedback layers four things:

1. **Pre-click hover glow.** 4–6 frames before the click, a soft radial highlight (~12px blur, brand accent at 0.2 opacity) materialises under the cursor on the target. Tells the viewer "about to click."
2. **Cursor depression.** At the click frame, cursor scales down to ~0.92 over 3 frames and recovers to 1.0 over 6 frames. Mimics finger pressure.
3. **Multi-ring ripple.** Two concentric rings, staggered by 4 frames. Ring 1: scale 0 → 2.4, opacity 0 → 0.5 → 0 over 18 frames. Ring 2: scale 0 → 1.6, opacity 0 → 0.35 → 0 over 14 frames. Compound feel reads as "click landed."
4. **Target depression** (optional, for buttons). At the click frame, target dips brightness ~6% and scales ~0.98 for 2–3 frames, paired with the ripple.

Touch indicator equivalent: disc compresses to ~0.78 at tap (already in the component), plus a second expanding ring staggered behind the first, plus an optional subtle highlight on the target.

The default `Pointer` and `TouchIndicator` components ship with #2 and the first half of #3. For premium feel, layer in #1 and the second ring. See platform-specific docs for the layering pattern.

## Captions — beyond "big and bold"

The 54–64px / weight 700 defaults get you to clean. Premium captions add:

- **5–7 word limit per caption.** If the line wraps to 3 lines, rewrite tighter. Headlines, not subtitles.
- **Mixed weight for emphasis.** Wrap the noun or verb that carries meaning in weight 800 inside a weight 500 line: `Search anything in <strong>milliseconds</strong>`. The eye lands on the differentiator.
- **Tighter letter-spacing at display size.** `-1` to `-2` at 54px+, not `-0.5`. Letter-spacing `-0.5` reads as "subtitle"; `-1.5` reads as "headline."
- **Optional muted subtitle.** A 20–24px line in 40% opacity below the headline, only when the headline needs context. Use sparingly.
- **Consider left-alignment** when the focal slice sits off-center. Captions centered while the focal element is off-axis reads as template; alignment to the focal element reads as composed.

## Content animations — proving the feature works

When the feature involves typing, calculating, or revealing data, **animate the actual content**. Dumping a string or popping a number undersells the feature.

- **Typewriter.** Per-character reveal at 50–90ms per char, decelerating toward the end, with a blinking caret. For "user typed this" moments.
- **Counter roll.** Interpolate the number over 30–45 frames with a decelerating ease, round per frame. For stats / metric reveals.
- **Staggered spring-in.** Search results, list rows, gallery thumbs spring up from 30–40px below with 8–12 frame stagger between items. For result reveals.
- **Number flip / digit roll.** Individual digit columns scrolling. Reserved for big "$1,234" reveals where the magnitude is the point.

These are the difference between "the feature exists" and "the feature feels alive."

## Transitions — never default

The crossfade between beats is its own design element. Defaults to avoid:

- **No fade-to-black.** Reads as "next chapter," not "next beat." Use content crossfades or shared-element transitions.
- **Shared-element transitions** when the same logical UI element appears in two consecutive beats — see [crop-techniques.md](./crop-techniques.md). Don't pop between similar slices.
- **Smart-cut alternatives** for non-shared transitions: a vertical wipe via animated `clip-path`, a scale-and-fade where the outgoing slice scales to 0.96 while the incoming scales from 1.04, a brief brightness lift across the cut.

## End card — the most-skipped moment

The end card is where most onboarding videos collapse into a static logo on black. Don't:

- **Logo enters with motion.** Spring in, or a soft mask reveal. Never a static drop-in.
- **Tagline animates separately.** Logo first, tagline 6–10 frames later, weight-mixed.
- **Background continues the visual identity.** Mesh gradient, vignette, ambient blob — same material as the rest of the video. Pure black with a centered logo is the default that says "I gave up at the end."
- **Optional pulse.** A soft single-cycle pulse on the logo (scale 1.0 → 1.02 → 1.0 over 24 frames) keeps the frame alive while the user sits with it.

## QA pass — before declaring the video done

Run every beat past these. A "no" means more work, not "good enough":

1. Is the focal element unmistakable in the first 6 frames?
2. Does anything pop in without easing?
3. Is the caption legible against the focal area for the entire beat?
4. Does the transition between beats feel intentional (shared element / content crossfade), or is it a default cut?
5. Does the hero beat feel slower and more deliberate than the others?
6. Is the cursor's path one single straight segment per move?
7. Is the background "alive" (ambient drift, gradient, light), or flat color?
8. Does the focal slice have depth (shadow, container chrome, optional glow)?
9. Are easings varied across elements within a beat, not uniform?
10. If you scrub frame-by-frame, are there any 1-frame stutters / unintended overlaps / frames where everything is mid-motion at once?
11. Does the end card feel composed, or is it a logo-on-black afterthought?

If you haven't sat with the rendered output and answered all 11, you haven't finished. Show the draft to the user only after this pass — earlier drafts waste their time correcting issues you'd catch yourself.

## Anti-tells of "elementary"

Any of these alone is enough to drop the video from "professional" to "made in an afternoon":

- Pure `#fff` or `#000` background with no gradient, vignette, or ambient light
- Focal slice with no shadow, border, or container chrome — slice floats like a cutout
- Every element in every beat uses the same easing curve
- Cursor enters from off-frame
- Single-ring click ripple with no cursor depression
- Every beat is the same length; no hero beat identified
- Crossfades default to fade-to-black
- Caption sits below or beside the focal element
- Caption uses letter-spacing of `0` or `-0.5` at 54px+
- Numbers appear instantly instead of rolling
- Typing animations dump the full string at once
- End card is a motionless logo on pure black
- Every motion uses spring with default damping — no variety, no anticipation, no settle
- No content animation on the feature's "proof" moment (the search result, the calculated value, the loaded data)

## When you're tempted to skip this

The pressure to ship cheap is real. Every one of these patterns adds 15–60 minutes to the build. The trade is what makes the difference between a video the user is proud to ship and one they'll quietly replace in three months. If the user only wants "good enough," they can ask explicitly — the default is the bar above.

# onboarding-video-core

Shared resources for the three platform-specific onboarding video skills:

- [`create-onboarding-video-web`](../create-onboarding-video-web/SKILL.md)
- [`create-onboarding-video-electron`](../create-onboarding-video-electron/SKILL.md)
- [`create-onboarding-video-ios`](../create-onboarding-video-ios/SKILL.md)

This directory has **no `SKILL.md`** — it is not a skill on its own. It exists so the three platform skills share one source of truth for the rules, the drop-in components, and the planning checklist instead of duplicating them.

## Layout

```
resources/
├── core-rules.md          # Universal rules: pieces-not-screens, captions, indicator motion
├── production-quality.md  # The bar — what makes a video look paid-for vs. elementary
├── shot-planning.md       # Intake checklist + timeline blocking
├── crop-techniques.md     # How to extract focal elements + present them with depth
├── top-caption.md         # Drop-in TopCaption component (all platforms)
├── pointer-cursor.md      # Drop-in mouse cursor component (web, electron)
├── touch-indicator.md     # Drop-in finger/touch component (iOS)
└── platform-defaults.md   # Quick lookup table: dimensions, fonts, output paths per platform
```

## How the platform skills use it

Each platform `SKILL.md` opens with a "Read these first" section that points at the relevant files in this directory in reading order. The platform skill itself only contains:

- platform-specific intake (e.g. how to capture stills from a running web dev server vs. an iOS simulator)
- platform-specific Remotion conventions (e.g. AgentCanvas's `tutorials.ts` integration vs. PokemonTCG's `sceneOnly` per-scene composition pattern)
- references back to this directory for the actual rules and drop-in code

If you change a rule that applies to *all* platforms (e.g. caption behavior, cursor motion, the pieces-not-screens rule), change it here in `core-rules.md` once. If you change something platform-specific, change the platform's `SKILL.md`.

## Why split by platform

Web, Electron, and iOS have different conventions that matter for whether the video feels native:

- **Indicator** — mouse arrow on web/electron, translucent disc on iOS.
- **Aspect ratio** — 16:9 default for web/electron in-app, 9:16 for iOS App Preview / web social.
- **Fonts** — project's web font on web, macOS native on electron, iOS native on iOS.
- **Output integration** — web renders to `out/`, electron renders to `src/renderer/public/tutorials/<id>.mp4` and registers in `tutorials.ts` with `?v=N` cache busting, iOS renders to `out/` for App Store submission.

Sharing a single skill that branches internally would bloat its description and dilute the auto-trigger heuristic. Three focused skills + one shared core is cleaner.

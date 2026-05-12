# Platform defaults — quick lookup

| | **Web (in-app)** | **Web (social)** | **Electron tutorial** | **iOS App Preview** |
|---|---|---|---|---|
| Canvas | 1920×1080 (16:9) | 1080×1920 (9:16) | 1280×720 (16:9) | 1080×1920 (9:16) |
| fps | 30 | 30 | 30 | 30 |
| Indicator | Mouse cursor (Pointer) | Mouse cursor (Pointer) | Mouse cursor (Pointer, scale 1.3) | Touch disc (TouchIndicator) |
| Caption defaults | 64px / maxW 1400 / topOffset 80 | 54px / maxW 880 / topOffset 100 | 44px / maxW 960 / topOffset 60 | 54px / maxW 880 / topOffset 100 |
| Default font | Project's web font | Project's web font | -apple-system stack | -apple-system stack |
| Background | Tinted brand color or blurred-self | Same | Match app palette (zinc/dark) | Tinted brand color |
| Output codec | H.264 / yuv420p / MP4 | Same | Same | Same |
| Length per beat | 4–7s | 3–6s | 4–8s | 3–6s |
| Total length | ≤30s | ≤15s | ≤45s (tutorials tolerate longer) | ≤30s |

## Project paths reference

If the user is in one of the known projects, use these conventions:

### PokemonTCG (web)
- Remotion root: `remotion/`
- Compositions: `remotion/src/Root.tsx`
- Scenes: `remotion/src/scenes/`
- Components: `remotion/src/components/`
- Stills go in: `remotion/public/<screen>/<state>.png`
- Render scripts: `npm run remotion:dev` (preview), `npm run remotion:build` (full build to `out/`)
- Per-flow render: `npx remotion render --config=remotion/remotion.config.ts remotion/src/index.ts <CompId> out/<name>.mp4`
- House fonts: Figtree (body), Instrument Serif (display), JetBrains Mono. Loaded via Google Fonts `<link>` in Root.tsx (already wired).

### AgentCanvas (electron)
- Remotion root: `remotion/` (separate package, has its own `package.json`)
- Compositions: `remotion/src/Root.tsx`
- Scenes: `remotion/src/scenes/`
- Output target: `src/renderer/public/tutorials/<id>.mp4` (and `<id>.jpg` poster)
- Render scripts: `pnpm run studio` (preview), `pnpm run render:<id>` per tutorial
- Add new tutorial: (1) create scene + register `<Composition id="<Id>">` in `Root.tsx`; (2) add `render:<id>` and `render:<id>:poster` scripts to `remotion/package.json`; (3) register entry in `src/renderer/data/tutorials.ts` with `media: { type: 'video', src: '/tutorials/<id>.mp4?v=<N>', posterSrc: '/tutorials/<id>.jpg?v=<N>', durationSec: <N> }`. Bump `?v=<N>` whenever re-rendering — Electron caches mp4 URLs aggressively.
- House font stack: `'-apple-system, BlinkMacSystemFont, Inter, "SF Pro Text", "Segoe UI", sans-serif'` (already exported from `theme.ts`).
- House palette: `theme.ts` (`bg: #09090b`, `text: #e4e4e7`, accent `#3b82f6`).

### Generic / unknown project
- Assume `remotion/` directory at project root.
- Stills go in `remotion/public/`.
- Output to `remotion/out/`.
- If no Remotion is installed, propose installing it before doing anything else (don't bootstrap silently).

## Typography per platform

The skill never restyles the app — it picks fonts that match what the app already uses. Defaults if the user doesn't specify:

| Platform | Default fontFamily | Why |
|---|---|---|
| Web | App's existing webfont (read from `tailwind.config.js` or stylesheet) | Match brand |
| Electron | `'-apple-system, BlinkMacSystemFont, Inter, "SF Pro Text", "Segoe UI", sans-serif'` | Looks native on macOS where most Electron tutorials are watched |
| iOS | `'-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif'` | iOS native |

For non-system fonts, use `@remotion/google-fonts` if the font is on Google Fonts; otherwise `@remotion/fonts` with a local file in `public/`.

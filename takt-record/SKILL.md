---
name: takt-record
description: Records a narrated, checked video of a web app working, then hands it to Takt (the user's video editor) to title, tighten and render, so the user can verify the work by watching it. Use when the user asks for a video, recording, walkthrough, demo or "show me it working" of a change, PR or feature in a browser, says "record your browser", "verify in Takt" or "QA video", or when they review your notes on such a video in Takt.
---

# Takt record

A take is a short script: what to say, what to do in the browser, and what must be true after. The recorder plays
it in a real Chromium with a drawn cursor that moves like a hand, says each line with macOS `say`, checks each claim
on screen (outlined green or red), and writes a 1080p video. `send` puts it in the PR's own Takt project with a title
card, a callout for every check and an end card ("6 of 7 checks passed"), cuts the long waits, and renders it.

```bash
R=~/.claude/skills/takt-record/scripts/takt-record.mjs
node $R rehearse take.json     # fast, no recording: fix targets and checks until it passes
node $R run take.json          # record + send to Takt + render; prints the bundle and the video
node $R notes <bundle>         # the user's notes on the video, placed back on the page
node $R note-done <bundle> <noteId> "what you changed"
```

Run it from the repo of the change: the bundle and the Takt project are named after its repo, branch and open PR
(`gh pr view`). One Takt project per PR; a new take of the same PR replaces the last one there.

## The loop

1. **Know what to prove.** Read the PR, the diff, the acceptance criteria. Each behaviour the user would check by hand
   becomes one beat.
2. **Explore first, off camera.** Use `agent-browser` (your own `--session`; never `close --all`) to walk the flow and
   read `snapshot` for the words on buttons and fields. Takes use those words, not `@e` refs.
3. **Write the take** in your scratchpad (format below).
4. **Rehearse** until every target is found and every check passes for the right reason. A check that fails in
   rehearsal is either a bug you shipped (fix the code) or a wrong check (fix the take). Never weaken a check to make
   it pass.
5. **Run.** Exit 1 means a check failed on camera. The video still renders and shows the ✗: report it, do not hide it.
6. **Tell the user** the video path, the Takt project name, and the checks line. Their Takt window shows the project.
7. **Notes.** When the user says they left notes, run `notes`: each comes with the beat, the page URL, the last thing
   done and what each drawn mark was on. Fix them, `note-done` each with one sentence, then take again.

## Take format

```json
{
  "title": "Card search keeps the term when you filter",
  "url": "https://shop.test/cards",
  "setup": [{ "type": "label=Email", "text": "qa@example.com" }, { "type": "label=Password", "text": "password" }, { "press": "Enter" }, { "waitForUrl": "/dashboard" }, { "goto": "/cards" }],
  "hide": [".cookie-banner"],
  "redact": ["[data-email]"],
  "beats": [
    {
      "say": "Search for Pikachu, and the grid narrows to the matching cards.",
      "do": [{ "type": "label=Search cards", "text": "Pikachu", "at": "Pikachu" }],
      "check": [{ "count": ".card", "is": 2, "label": "Two Pikachu cards" }]
    },
    {
      "say": "Filter to rare cards. The search term stays, in the box and in the address.",
      "do": [{ "click": "text=Rare", "at": "rare cards" }],
      "check": [{ "value": "label=Search cards", "is": "Pikachu", "label": "Search still says Pikachu" }, { "url": "q=Pikachu", "label": "Term is in the URL" }]
    }
  ]
}
```

- `title` becomes the title card. `url` is opened first; `goto` paths are relative to it.
- `setup` runs before recording starts, off camera: logins, seeding through the UI, closing a banner.
- `hide` (`visibility: hidden`) and `redact` (blurred) take CSS selectors. Laravel Debugbar and Symfony's toolbar are
  hidden already; error overlays are not, since they are findings.
- Optional: `viewport` (`[1600, 900]` default, any 16:9), `voice` (a `say -v '?'` name), `rate` (185 words a minute),
  `narrate: false`, `insecure: true` (an untrusted local HTTPS certificate), `project` (the Takt project's name).
- A beat: `say` (one line), `do` (actions, in order), `check` (claims), `holdMs` (extra time on screen after).
- `{run}` anywhere in the take becomes a stamp new to each run, for a value the app refuses twice: a sign-up's
  `"ash+{run}@example.com"`. Rehearsal is a run too, so without it the real take finds the email taken. A sign-up is
  often rate limited too (a few a minute): leave a minute between a rehearsal and the take.

**Targets:** `text=Save` (the element whose text is exactly that; `text=/save/i` for a pattern), `label=Email` (a field by
its label, aria-label or placeholder; a required field's trailing `*` is ignored), or any CSS selector. Prefer text and
label: they read like the UI and survive refactors.

**Actions:** `{ "click": t }`, `{ "hover": t }`, `{ "type": t, "text": "…", "clear": true }`,
`{ "select": t, "option": "…" }` (a dropdown, by the option's words: its own menu never shows in a recording, so the
cursor presses it and the option is picked), `{ "press": "Enter" }` or
`"Meta+k"` (shortcuts show as a key chip), `{ "scroll": t }` or `{ "scroll": 600 }`, `{ "goto": "/path" }`,
`{ "wait": 800 }`, `{ "waitFor": t }`, `{ "waitForUrl": "/done" }`. Add `"at": "a phrase of the line"` to an action to
make it land as that phrase is said; without it, actions follow each other at a natural pace.

**Checks:** `{ "see": t }`, `{ "notSee": t }`, `{ "url": "part" }`, `{ "value": t, "is" | "has": "…" }`,
`{ "text": t, "is" | "has": "…" }`, `{ "count": t, "is" | "atLeast" | "atMost": n }`. Each retries for up to 4 s
(`timeoutMs`) so async UI settles. Give every check a `label`: the claim, as the viewer reads it in the callout.

## Making it good

- **One beat per behaviour**, 10 to 20 seconds each, 60 to 120 seconds in all. Lead with the change itself; skip the
  login (that is what `setup` is for).
- **The line says what is about to happen and why it matters**, in the present tense: "Filter to rare cards. The
  search term stays." Not "I'm going to click the rare button". Under 25 words a beat.
- **Anchor the key click** with `at` to the word that names it, so the screen and the voice agree.
- **Every claim the voice makes, a check proves.** The callouts are the receipt.
- **Show the edge case** the PR fixed, not just the happy path: the empty state, the error message, the second visit.
- The voice is the best installed English one: a Premium or Enhanced voice when there is one (System Settings →
  Accessibility → Spoken Content → System voice → Manage Voices), else Samantha.

## Someone else's browser

`--cdp <port|ws url> --page <part of its URL>` records a browser that is already open (an AgentCanvas tile, a
logged-in session) instead of launching one. It sets the page to the take's layout size while recording and puts it
back after. Everything else is the same.

## What a bundle holds

`~/Movies/Takt QA/<repo>/<pr-N or branch>/<time>/` (or `--out`): `screen.mp4` (1080p30 H.264, the voice at -16 LUFS),
`narration.wav`, `events.json` (every beat, action and check with its time and on-screen box, every page visited),
`take.json`, and after `send`, `takt.json` (the project and the rendered video). `notes` adds `notes.json`.

## Needs

Node 22+, ffmpeg (`brew install ffmpeg`), a Chromium in Playwright's cache (`npx playwright install chromium`, or
`TAKT_RECORD_CHROME`), and Takt running for `send` and `notes` (`--takt-home <dir>` for a Takt started with
`TAKT_HOME`). Takt must have `storyboard_footage_import` and `storyboard_project_open` (VideoStoryboard PR
"agent recordings").

#!/usr/bin/env node
/**
 * Records a narrated, checked walkthrough of a web app for Takt. See ../SKILL.md for the take format.
 *
 *   takt-record.mjs rehearse <take.json>        run it fast, no recording: are the targets and checks right?
 *   takt-record.mjs record <take.json>          the voice, the take, screen.mp4 + events.json in a bundle folder
 *   takt-record.mjs send <bundle>               into the PR's Takt project: titles, check callouts, tightened, rendered
 *   takt-record.mjs run <take.json>             record, then send
 *   takt-record.mjs notes <bundle> [--all]      the user's notes on the video, placed back on the page
 *   takt-record.mjs note-done <bundle> <noteId> <what you changed>
 *
 * A take plays its before section first (the app as the base branch has it, on a site serving that branch), then
 * the PR's own beats. In a take, {run} becomes a stamp new to each run: a field that must be new every time.
 *
 * Options: --out <dir>  --cdp <port|url> --page <url part> (record someone's browser instead of launching one)
 *          --headed  --takt-home <dir>  --no-render  --no-tighten (keep the waits: a render Takt fails after tightening)  --keep-frames
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { assemble } from './lib/assemble.mjs'
import { attachPage, browserSocket, connect, launch, pageOf } from './lib/cdp.mjs'
import { Driver, quoted } from './lib/driver.mjs'
import { phraseAt, pickVoice, sayBeats } from './lib/narration.mjs'
import { overlaySource } from './lib/overlay.mjs'
import { noteDone, notes, projectName, send } from './lib/takt.mjs'
import { clock, ffmpegTools, gitInfo, lower, prInfo, sleep, slug, tryRun } from './lib/util.mjs'

const VERBS = ['goto', 'click', 'hover', 'type', 'select', 'press', 'scroll', 'wait', 'waitFor', 'waitForUrl']
const CHECKS = ['see', 'notSee', 'url', 'value', 'text', 'count']
/** Dev toolbars nobody needs to see in a QA video. Error overlays stay: they are findings. */
const DEFAULT_HIDE = ['.phpdebugbar', '.sf-toolbar', 'astro-dev-toolbar']
const LEAD_IN_MS = 900
const TAIL_MS = 1500
/** A move anchored to a phrase starts this early, so the click lands as the word is said. */
const PHRASE_LEAD_MS = 350
const BEAT_GAP_MS = 600
/** Held after the before section's last beat, before the cut to the PR. */
const SECTION_TAIL_MS = 900
/** What each part of a take is called on screen and in the log. */
const SECTION_NAME = { before: 'Before this PR', pr: 'With this PR' }

function parseArgs(argv) {
  const opts = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) opts._.push(a)
    else if (['--headed', '--no-render', '--no-tighten', '--keep-frames', '--all'].includes(a)) opts[a.slice(2)] = true
    else opts[a.slice(2)] = argv[++i]
  }
  return opts
}

function loadTake(path) {
  const take = JSON.parse(readFileSync(path, 'utf8').replaceAll('{run}', Date.now().toString(36).slice(-6)))
  const problems = []
  if (!take.title) problems.push('title: say what the take shows (it becomes the title card)')
  if (!Array.isArray(take.beats) || !take.beats.length) problems.push('beats: at least one beat')
  const [w, h] = take.viewport ?? [1600, 900]
  if (Math.abs(w / h - 16 / 9) > 0.01) problems.push(`viewport: [${w}, ${h}] is not 16:9`)
  checkSteps(take.setup, 'setup', problems)
  checkBeats(take.beats, 'beats', problems)

  const before = take.before
  if (before === undefined || before === null) {
    problems.push('before: show the app as it was before this change, then the change: { "url": a site on the base branch, "beats": [...] }, or { "skip": "why nothing changed on screen" }')
  } else if ('skip' in before) {
    if (typeof before.skip !== 'string' || !before.skip.trim()) problems.push('before.skip: say why there is nothing to show from before (it goes on a card)')
  } else {
    if (!before.url) problems.push('before.url: a site serving the base branch (a worktree of it, staging), not the PR\'s own site')
    else if (take.url && !before.sameSite && sameOrigin(before.url, take.url)) {
      problems.push(`before.url: ${before.url} is the PR's own site, so it would show the change; point it at a site on the base branch, or set sameSite: true when before.setup turns the old behaviour back on (a feature flag)`)
    }
    if (!Array.isArray(before.beats) || !before.beats.length) problems.push('before.beats: at least one beat showing what it was like')
    checkSteps(before.setup, 'before.setup', problems)
    checkBeats(before.beats ?? [], 'before.beats', problems)
  }
  if (problems.length) throw new Error(`${path} is not a take yet:\n  ${problems.join('\n  ')}`)

  const sections = []
  if (!('skip' in before)) sections.push({ key: 'before', url: before.url, setup: before.setup ?? take.setup ?? [], beats: before.beats, ref: before.ref ?? null })
  sections.push({ key: 'pr', url: take.url, setup: take.setup ?? [], beats: take.beats })
  return { ...take, viewport: [w, h], sections }
}

function checkSteps(steps, where, problems) {
  for (const [i, a] of (steps ?? []).entries()) checkAction(a, `${where}[${i}]`, problems)
}

function checkAction(a, where, problems) {
  const verbs = VERBS.filter((v) => v in a)
  if (verbs.length !== 1) problems.push(`${where}: one of ${VERBS.join(', ')} (got ${Object.keys(a).join(', ') || 'nothing'})`)
  if ('type' in a && typeof a.text !== 'string') problems.push(`${where}: type needs text`)
  if ('select' in a && typeof a.option !== 'string') problems.push(`${where}: select needs option`)
}

function checkBeats(beats, where, problems) {
  if (!Array.isArray(beats)) return
  for (const [i, beat] of beats.entries()) {
    for (const [j, a] of (beat.do ?? []).entries()) {
      checkAction(a, `${where}[${i}].do[${j}]`, problems)
      if (a.at && !beat.say) problems.push(`${where}[${i}].do[${j}]: "at" needs the beat to say something`)
      else if (a.at) {
        try {
          phraseAt(beat.say, a.at, 1)
        } catch (err) {
          problems.push(`${where}[${i}].do[${j}]: ${err.message}`)
        }
      }
    }
    for (const [j, c] of (beat.check ?? []).entries()) {
      if (CHECKS.filter((k) => k in c).length !== 1) problems.push(`${where}[${i}].check[${j}]: one of ${CHECKS.join(', ')}`)
      if (('value' in c || 'text' in c) && c.is === undefined && c.has === undefined) problems.push(`${where}[${i}].check[${j}]: give is or has`)
    }
  }
}

function sameOrigin(a, b) {
  try {
    return new URL(a).origin === new URL(b).origin
  } catch {
    return false
  }
}

async function openSession(take, opts, fast) {
  const own = !opts.cdp
  const [width, height] = take.viewport
  const browser = own
    ? await launch({ headed: opts.headed, insecure: take.insecure, width, height, scale: 1920 / width })
    : { wsUrl: await browserSocket(opts.cdp), close: async () => {} }
  const conn = await connect(browser.wsUrl)
  const { sessionId } = await attachPage(conn, opts.page)
  const page = pageOf(conn, sessionId)
  await page.send('Page.enable')
  await page.send('Runtime.enable')
  // Someone else's browser keeps its own scale factor (a Retina screen's 2 records sharper still); only the layout size is set.
  if (!own) await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 0, mobile: false })
  const source = overlaySource({ hide: [...DEFAULT_HIDE, ...(take.hide ?? [])], redact: take.redact ?? [] })
  const { identifier } = await page.send('Page.addScriptToEvaluateOnNewDocument', { source })
  await page.send('Runtime.evaluate', { expression: source })
  const driver = new Driver(page, { viewport: { width, height }, seed: take.title, fast })
  await driver.init()
  const close = async () => {
    if (!own) {
      await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier }).catch(() => {})
      await driver.takt('off').catch(() => {})
      await page.send('Emulation.clearDeviceMetricsOverride').catch(() => {})
    }
    conn.close()
    await browser.close()
  }
  return { page, driver, close }
}

const verbOf = (a) => VERBS.find((v) => v in a)
const targetOf = (a) => String(a[verbOf(a)])

async function act(driver, a, base) {
  const verb = verbOf(a)
  switch (verb) {
    case 'goto':
      return driver.goto(new URL(a.goto, base).href)
    case 'click':
      return driver.click(a.click)
    case 'hover':
      return driver.hover(a.hover)
    case 'type':
      return driver.type(a.type, a.text, { clear: a.clear === true })
    case 'select':
      return driver.select(a.select, a.option)
    case 'press':
      return driver.press(a.press)
    case 'scroll':
      return driver.scroll(a.scroll)
    case 'wait':
      return sleep(a.wait)
    case 'waitFor':
      return driver.waitFor(a.waitFor, a.timeoutMs)
    case 'waitForUrl':
      return driver.waitForUrl(a.waitForUrl, a.timeoutMs)
  }
}

async function setUp(driver, section, log) {
  if (section.url) await driver.goto(section.url)
  for (const a of section.setup) await act(driver, a, section.url)
  if (section.setup.length) log(`Set up ${lower(SECTION_NAME[section.key])}: ${section.setup.length} steps, off camera`)
}

/**
 * Plays one section's beats. Each starts when the one before has finished on screen, and its voice is laid there
 * afterwards, so the words always describe what is showing. A move with `at` waits for that phrase of its line.
 * `n0` is how many beats came before (the before section's), so beats and their voice clips number straight through.
 */
async function playBeats(driver, section, clips, { now, log, n0 = 0, navigations }) {
  const beats = []
  let url = await driver.url()
  navigations.push({ atMs: now(), url })
  for (const [i, beat] of section.beats.entries()) {
    const n = n0 + i + 1
    const startMs = now()
    const voiceMs = clips[n - 1]?.ms ?? 0
    const actions = []
    const checks = []
    for (const [j, a] of (beat.do ?? []).entries()) {
      const due = a.at ? startMs + phraseAt(beat.say, a.at, voiceMs) - PHRASE_LEAD_MS : j === 0 ? startMs + 250 : now() + 200
      await sleep(due - now())
      const begun = now()
      try {
        const box = await act(driver, a, section.url)
        actions.push({ n: j + 1, kind: verbOf(a), target: targetOf(a), startMs: begun, endMs: now(), ...(box?.width ? { box } : {}) })
        if (a.at && voiceMs && begun - due > 500) log(`  beat ${n}: "${a.at}" came ${((begun - due) / 1000).toFixed(1)} s late`)
      } catch (err) {
        const label = `Could not ${verbOf(a)} ${quoted(targetOf(a)) ?? targetOf(a)}`
        await driver.takt('fail', label).catch(() => {})
        checks.push({ label, pass: false, actual: err.message, atMs: now() })
        log(`  ✗ beat ${n}: ${err.message}`)
        break
      }
      const at = await driver.url()
      if (at !== url) navigations.push({ atMs: now(), url: (url = at) })
    }
    for (const c of beat.check ?? []) {
      // When it shows on screen: the outline, or the red chip of a failure with nothing to outline.
      const result = await driver.check(c)
      checks.push({ ...result, atMs: now() })
      log(`  ${result.pass ? '✓' : '✗'} ${result.label}${result.pass ? '' : ` (saw: ${result.actual})`}`)
    }
    const voiceEndMs = startMs + voiceMs
    const endMs = Math.max(voiceEndMs + BEAT_GAP_MS + (beat.holdMs ?? 0), now() + 400)
    await sleep(endMs - now())
    beats.push({ n, section: section.key, say: beat.say ?? '', startMs, voiceMs, voiceEndMs, endMs, actions, checks })
  }
  return beats
}

/** "2 of 2" for one section's checks. */
const tally = (beats) => {
  const checks = beats.flatMap((b) => b.checks)
  return { passed: checks.filter((c) => c.pass).length, total: checks.length }
}

async function rehearse(takePath, opts) {
  const take = loadTake(takePath)
  const { driver, close } = await openSession(take, opts, true)
  const t0 = Date.now()
  const now = () => Date.now() - t0
  try {
    const beats = []
    for (const section of take.sections) {
      console.log(SECTION_NAME[section.key])
      await setUp(driver, section, console.log)
      beats.push(...(await playBeats(driver, section, [], { now, log: console.log, n0: beats.length, navigations: [] })))
    }
    const lines = take.sections.map((s) => {
      const { passed, total } = tally(beats.filter((b) => b.section === s.key))
      return `${lower(SECTION_NAME[s.key])} ${passed} of ${total}`
    })
    const { passed, total } = tally(beats)
    console.log(`Rehearsal: ${passed === total ? `all ${total} checks pass` : `${total - passed} of ${total} checks failed`} (${lines.join(', ')})`)
    return passed === total ? 0 : 1
  } finally {
    await close()
  }
}

/** The base branch's name and commit for the before card: origin's copy when there is one, as the before site runs it. */
async function baseOf(section, pr, cwd) {
  const ref = section.ref ?? pr?.baseRefName ?? null
  if (!ref) return { ref: null, sha: null }
  const sha = (await tryRun('git', ['rev-parse', '--verify', '--quiet', `origin/${ref}`], { cwd })) ?? (await tryRun('git', ['rev-parse', '--verify', '--quiet', ref], { cwd }))
  return { ref, sha }
}

async function record(takePath, opts) {
  const take = loadTake(takePath)
  const cwd = process.cwd()
  const [git, pr] = await Promise.all([gitInfo(cwd), prInfo(cwd)])
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ').replace(/:/g, '.')
  const bundle = resolve(opts.out ?? join(homedir(), 'Movies', 'Takt QA', git?.repo ?? 'web', slug(pr ? `pr-${pr.number}` : (git?.branch ?? take.title)), stamp))
  const framesDir = join(bundle, 'frames')
  mkdirSync(framesDir, { recursive: true })
  const { ffmpeg, ffprobe } = ffmpegTools()
  const allBeats = take.sections.flatMap((s) => s.beats)

  let voice = null
  let clips = []
  if (take.narrate !== false) {
    const picked = await pickVoice(take.voice)
    voice = picked.name
    if (picked.note) console.log(`Voice: ${voice} (${picked.note})`)
    clips = await sayBeats(allBeats, { dir: bundle, voice, rate: take.rate ?? 185, ffmpeg, ffprobe })
    console.log(`Voice: ${voice ?? 'the system voice'}, ${clock(clips.reduce((s, c) => s + (c?.ms ?? 0), 0))} said over ${allBeats.length} beats`)
  }

  const { page, driver, close } = await openSession(take, opts, false)
  const frames = []
  const writes = []
  // The cut between the sections: the PR's setup runs off camera there, and the recording's clock skips it.
  const pauses = []
  let t0 = 0
  page.on('Page.screencastFrame', (f) => {
    page.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
    const at = f.metadata?.timestamp ? f.metadata.timestamp * 1000 : Date.now()
    if (pauses.some((p) => at > p.from && (p.to === null || at < p.to))) return
    const skipped = pauses.filter((p) => p.to !== null && p.to <= at).reduce((s, p) => s + p.to - p.from, 0)
    const name = `f${String(frames.length).padStart(6, '0')}.jpg`
    frames.push({ name, ms: Math.round(at - t0 - skipped) })
    writes.push(writeFile(join(framesDir, name), Buffer.from(f.data, 'base64')))
  })
  const now = () => Date.now() - t0 - pauses.reduce((s, p) => s + (p.to ?? Date.now()) - p.from, 0)
  const screencast = async () => {
    const had = frames.length
    await page.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 2560, maxHeight: 1440, everyNthFrame: 1 })
    for (let i = 0; i < 15 && frames.length === had; i++) await sleep(100)
    if (frames.length === had) await driver.mouse('mouseMoved', driver.at.x + 1, driver.at.y)
    await sleep(LEAD_IN_MS)
  }
  const beats = []
  const navigations = []
  const sections = []
  let endMs
  try {
    for (const [k, section] of take.sections.entries()) {
      let pause = null
      if (k > 0) {
        await sleep(SECTION_TAIL_MS)
        pause = { from: Date.now(), to: null }
        pauses.push(pause)
        await page.send('Page.stopScreencast')
      }
      await setUp(driver, section, console.log)
      await driver.moveTo(driver.at.x, driver.at.y)
      await driver.takt('at', driver.at.x, driver.at.y)
      if (pause) pause.to = Date.now()
      else t0 = Date.now()
      const startMs = now()
      await screencast()
      if (k === 0) console.log(`Recording "${take.title}"`)
      console.log(SECTION_NAME[section.key])
      const played = await playBeats(driver, section, clips, { now, log: console.log, n0: beats.length, navigations })
      beats.push(...played)
      const base = section.key === 'before' ? await baseOf(section, pr, cwd) : { ref: git?.branch ?? null, sha: git?.sha ?? null }
      sections.push({ key: section.key, label: SECTION_NAME[section.key], url: section.url ?? null, ...base, startMs, endMs: now(), ...tally(played) })
    }
    await sleep(TAIL_MS)
    endMs = now()
    await page.send('Page.stopScreencast')
    await sleep(300)
  } finally {
    await close()
  }
  await Promise.all(writes)

  const { screen } = await assemble({
    dir: bundle,
    framesDir,
    frames,
    endMs,
    voice: beats.map((b, i) => (clips[i] ? { path: clips[i].path, atMs: b.startMs } : null)),
    ffmpeg
  })
  const { passed, total } = tally(beats)
  // Each section runs up to the cut into the next, so its label stays up through the pause before it.
  for (const [i, s] of sections.entries()) s.endMs = sections[i + 1]?.startMs ?? endMs
  const events = {
    version: 2,
    title: take.title,
    ...(take.project ? { project: take.project } : {}),
    url: take.url ?? null,
    recordedAt: new Date(t0).toISOString(),
    git,
    pr,
    voice,
    viewport: { width: take.viewport[0], height: take.viewport[1], scale: 1920 / take.viewport[0] },
    durationMs: endMs,
    ok: passed === total,
    passed,
    total,
    sections,
    ...('skip' in take.before ? { beforeSkipped: take.before.skip } : {}),
    beats,
    navigations
  }
  events.project = projectName(events)
  writeFileSync(join(bundle, 'events.json'), `${JSON.stringify(events, null, 2)}\n`)
  // As played, with {run} filled in.
  const { sections: _played, ...asWritten } = take
  writeFileSync(join(bundle, 'take.json'), `${JSON.stringify(asWritten, null, 2)}\n`)
  // Each beat's voice is in narration.wav now.
  for (const c of clips) if (c) for (const f of [c.path, c.path.replace(/\.wav$/, '.aiff')]) rmSync(f, { force: true })
  if (!opts['keep-frames']) rmSync(framesDir, { recursive: true, force: true })
  const parts = sections.map((s) => `${lower(s.label)} ${s.passed} of ${s.total}`).join(', ')
  console.log(`${events.ok ? '✓' : '✗'} ${passed} of ${total} checks passed (${parts}) · ${clock(endMs)} · ${frames.length} frames`)
  console.log(`Bundle: ${bundle}`)
  console.log(`Video:  ${screen}`)
  return { bundle, events }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const [command, target, ...rest] = opts._
  const taktHome = opts['takt-home']
  switch (command) {
    case 'rehearse':
      return rehearse(target, opts)
    case 'record': {
      const { events } = await record(target, opts)
      return events.ok ? 0 : 1
    }
    case 'run': {
      const { bundle, events } = await record(target, opts)
      const sent = await send(bundle, { taktHome, render: !opts['no-render'], tighten: !opts['no-tighten'] })
      console.log(`Takt: "${sent.project}"${sent.video ? ` → ${sent.video}` : ''}`)
      return events.ok ? 0 : 1
    }
    case 'send': {
      const sent = await send(resolve(target), { taktHome, render: !opts['no-render'], tighten: !opts['no-tighten'] })
      console.log(`Takt: "${sent.project}"${sent.video ? ` → ${sent.video}` : ''}`)
      return 0
    }
    case 'notes': {
      const list = await notes(resolve(target), { taktHome, all: opts.all })
      if (!list.length) console.log('No open notes on this video.')
      for (const [i, n] of list.entries()) {
        const p = n.place
        console.log(`\n${i + 1}. ${n.id}${n.done ? ' (done)' : ''} at ${clock(n.atMs)} in the video${n.about === 'sound' ? ', about the sound' : ''}`)
        console.log(`   "${n.text}"`)
        if (p?.beat) console.log(`   beat ${p.beat.n}${p.beat.section === 'before' ? ' (before this PR)' : ''}: "${p.beat.say}"`)
        if (p?.url) console.log(`   page: ${p.url}`)
        if (p?.lastAction) console.log(`   just before: ${p.lastAction.kind} ${p.lastAction.target} (${clock(p.lastAction.atMs)} into the recording)`)
        for (const m of p?.marks ?? []) console.log(`   mark ${m.label}: ${m.pagePx ? `page px x ${m.pagePx.x}–${m.pagePx.x + m.pagePx.width}, y ${m.pagePx.y}–${m.pagePx.y + m.pagePx.height}` : m.where}${m.target ? `, on ${m.target}` : ''}`)
        if (n.pictures?.marked ?? n.frame) console.log(`   picture: ${n.pictures?.marked ?? n.frame}`)
      }
      return 0
    }
    case 'note-done':
      await noteDone(resolve(target), rest[0], rest.slice(1).join(' '), { taktHome })
      console.log(`Marked ${rest[0]} done in Takt`)
      return 0
    default:
      const lines = readFileSync(new URL(import.meta.url), 'utf8').split('\n')
      console.log(lines.slice(2, lines.indexOf(' */')).map((l) => l.replace(/^ \* ?/, '')).join('\n'))
      return command ? 2 : 0
  }
}

main().then(
  (code) => process.exit(code ?? 0),
  (err) => {
    console.error(`takt-record: ${err.message}`)
    process.exit(1)
  }
)

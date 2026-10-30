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
 * In a take, {run} becomes a stamp new to each run: a field that must be new every time (a sign-up's email).
 *
 * Options: --out <dir>  --cdp <port|url> --page <url part> (record someone's browser instead of launching one)
 *          --headed  --takt-home <dir>  --no-render  --keep-frames
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
import { clock, ffmpegTools, gitInfo, prInfo, sleep, slug } from './lib/util.mjs'

const VERBS = ['goto', 'click', 'hover', 'type', 'select', 'press', 'scroll', 'wait', 'waitFor', 'waitForUrl']
const CHECKS = ['see', 'notSee', 'url', 'value', 'text', 'count']
/** Dev toolbars nobody needs to see in a QA video. Error overlays stay: they are findings. */
const DEFAULT_HIDE = ['.phpdebugbar', '.sf-toolbar', 'astro-dev-toolbar']
const LEAD_IN_MS = 900
const TAIL_MS = 1500
/** A move anchored to a phrase starts this early, so the click lands as the word is said. */
const PHRASE_LEAD_MS = 350
const BEAT_GAP_MS = 600

function parseArgs(argv) {
  const opts = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) opts._.push(a)
    else if (['--headed', '--no-render', '--keep-frames', '--all'].includes(a)) opts[a.slice(2)] = true
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
  const action = (a, where) => {
    const verbs = VERBS.filter((v) => v in a)
    if (verbs.length !== 1) problems.push(`${where}: one of ${VERBS.join(', ')} (got ${Object.keys(a).join(', ') || 'nothing'})`)
    if ('type' in a && typeof a.text !== 'string') problems.push(`${where}: type needs text`)
    if ('select' in a && typeof a.option !== 'string') problems.push(`${where}: select needs option`)
  }
  for (const [i, a] of (take.setup ?? []).entries()) action(a, `setup[${i}]`)
  for (const [i, beat] of (take.beats ?? []).entries()) {
    for (const [j, a] of (beat.do ?? []).entries()) {
      action(a, `beats[${i}].do[${j}]`)
      if (a.at && !beat.say) problems.push(`beats[${i}].do[${j}]: "at" needs the beat to say something`)
      else if (a.at) {
        try {
          phraseAt(beat.say, a.at, 1)
        } catch (err) {
          problems.push(`beats[${i}].do[${j}]: ${err.message}`)
        }
      }
    }
    for (const [j, c] of (beat.check ?? []).entries()) {
      if (CHECKS.filter((k) => k in c).length !== 1) problems.push(`beats[${i}].check[${j}]: one of ${CHECKS.join(', ')}`)
      if (('value' in c || 'text' in c) && c.is === undefined && c.has === undefined) problems.push(`beats[${i}].check[${j}]: give is or has`)
    }
  }
  if (problems.length) throw new Error(`${path} is not a take yet:\n  ${problems.join('\n  ')}`)
  return { ...take, viewport: [w, h] }
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

async function act(driver, a, take) {
  const verb = verbOf(a)
  switch (verb) {
    case 'goto':
      return driver.goto(new URL(a.goto, take.url).href)
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

async function setUp(driver, take, log) {
  if (take.url) await driver.goto(take.url)
  for (const a of take.setup ?? []) await act(driver, a, take)
  if (take.setup?.length) log(`Set up: ${take.setup.length} steps, off camera`)
}

/**
 * Plays the beats. Each starts when the one before has finished on screen, and its voice is laid there afterwards,
 * so the words always describe what is showing. A move with `at` waits for that phrase of its line.
 */
async function playBeats(driver, take, clips, now, log) {
  const beats = []
  const navigations = []
  let url = await driver.url()
  navigations.push({ atMs: now(), url })
  for (const [i, beat] of take.beats.entries()) {
    const startMs = now()
    const voiceMs = clips[i]?.ms ?? 0
    const actions = []
    const checks = []
    for (const [j, a] of (beat.do ?? []).entries()) {
      const due = a.at ? startMs + phraseAt(beat.say, a.at, voiceMs) - PHRASE_LEAD_MS : j === 0 ? startMs + 250 : now() + 200
      await sleep(due - now())
      const begun = now()
      try {
        const box = await act(driver, a, take)
        actions.push({ n: j + 1, kind: verbOf(a), target: targetOf(a), startMs: begun, endMs: now(), ...(box?.width ? { box } : {}) })
        if (a.at && voiceMs && begun - due > 500) log(`  beat ${i + 1}: "${a.at}" came ${((begun - due) / 1000).toFixed(1)} s late`)
      } catch (err) {
        const label = `Could not ${verbOf(a)} ${quoted(targetOf(a)) ?? targetOf(a)}`
        await driver.takt('fail', label).catch(() => {})
        checks.push({ label, pass: false, actual: err.message, atMs: now() })
        log(`  ✗ beat ${i + 1}: ${err.message}`)
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
    beats.push({ n: i + 1, say: beat.say ?? '', startMs, voiceMs, voiceEndMs, endMs, actions, checks })
  }
  return { beats, navigations }
}

async function rehearse(takePath, opts) {
  const take = loadTake(takePath)
  const { driver, close } = await openSession(take, opts, true)
  const t0 = Date.now()
  try {
    await setUp(driver, take, console.log)
    const { beats } = await playBeats(driver, take, [], () => Date.now() - t0, console.log)
    const checks = beats.flatMap((b) => b.checks)
    const failed = checks.filter((c) => !c.pass)
    console.log(failed.length ? `Rehearsal: ${failed.length} of ${checks.length} checks failed` : `Rehearsal: all ${checks.length} checks pass`)
    return failed.length ? 1 : 0
  } finally {
    await close()
  }
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

  let voice = null
  let clips = []
  if (take.narrate !== false) {
    const picked = await pickVoice(take.voice)
    voice = picked.name
    if (picked.note) console.log(`Voice: ${voice} (${picked.note})`)
    clips = await sayBeats(take.beats, { dir: bundle, voice, rate: take.rate ?? 185, ffmpeg, ffprobe })
    console.log(`Voice: ${voice ?? 'the system voice'}, ${clock(clips.reduce((s, c) => s + (c?.ms ?? 0), 0))} said over ${take.beats.length} beats`)
  }

  const { page, driver, close } = await openSession(take, opts, false)
  const frames = []
  const writes = []
  let t0 = 0
  page.on('Page.screencastFrame', (f) => {
    const name = `f${String(frames.length).padStart(6, '0')}.jpg`
    const at = f.metadata?.timestamp ? f.metadata.timestamp * 1000 : Date.now()
    frames.push({ name, ms: Math.round(at - t0) })
    writes.push(writeFile(join(framesDir, name), Buffer.from(f.data, 'base64')))
    page.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
  })
  let played
  let endMs
  try {
    await setUp(driver, take, console.log)
    await driver.moveTo(driver.at.x, driver.at.y)
    await driver.takt('at', driver.at.x, driver.at.y)
    t0 = Date.now()
    const now = () => Date.now() - t0
    await page.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 2560, maxHeight: 1440, everyNthFrame: 1 })
    for (let i = 0; i < 15 && !frames.length; i++) await sleep(100)
    if (!frames.length) await driver.mouse('mouseMoved', driver.at.x + 1, driver.at.y)
    await sleep(LEAD_IN_MS)
    console.log(`Recording "${take.title}"`)
    played = await playBeats(driver, take, clips, now, console.log)
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
    voice: played.beats.map((b, i) => (clips[i] ? { path: clips[i].path, atMs: b.startMs } : null)),
    ffmpeg
  })
  const checks = played.beats.flatMap((b) => b.checks)
  const passed = checks.filter((c) => c.pass).length
  const events = {
    version: 1,
    title: take.title,
    ...(take.project ? { project: take.project } : {}),
    url: take.url ?? null,
    recordedAt: new Date(t0).toISOString(),
    git,
    pr,
    voice,
    viewport: { width: take.viewport[0], height: take.viewport[1], scale: 1920 / take.viewport[0] },
    durationMs: endMs,
    ok: passed === checks.length,
    passed,
    total: checks.length,
    beats: played.beats,
    navigations: played.navigations
  }
  events.project = projectName(events)
  writeFileSync(join(bundle, 'events.json'), `${JSON.stringify(events, null, 2)}\n`)
  // As played, with {run} filled in.
  writeFileSync(join(bundle, 'take.json'), `${JSON.stringify(take, null, 2)}\n`)
  // Each beat's voice is in narration.wav now.
  for (const c of clips) if (c) for (const f of [c.path, c.path.replace(/\.wav$/, '.aiff')]) rmSync(f, { force: true })
  if (!opts['keep-frames']) rmSync(framesDir, { recursive: true, force: true })
  console.log(`${events.ok ? '✓' : '✗'} ${passed} of ${checks.length} checks passed · ${clock(endMs)} · ${frames.length} frames`)
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
      const sent = await send(bundle, { taktHome, render: !opts['no-render'] })
      console.log(`Takt: "${sent.project}"${sent.video ? ` → ${sent.video}` : ''}`)
      return events.ok ? 0 : 1
    }
    case 'send': {
      const sent = await send(resolve(target), { taktHome, render: !opts['no-render'] })
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
        if (p?.beat) console.log(`   beat ${p.beat.n}: "${p.beat.say}"`)
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

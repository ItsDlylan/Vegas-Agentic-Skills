/**
 * Handing a take to Takt through its local API (the same routes its storyboard_* MCP tools call): the PR's own
 * project, the recording on its footage track, a title, a callout for every check and an end card, the long waits
 * tightened, and the video rendered. Then the other way: the notes the user draws on that video, told in terms of
 * the page they were about.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { clock, sleep } from './util.mjs'

/** Takt's API address and token, from the file the running app writes. */
export function endpoint({ taktHome } = {}) {
  const file =
    process.env.TAKT_API_ENDPOINT ??
    (taktHome ?? process.env.TAKT_HOME ? join(taktHome ?? process.env.TAKT_HOME, 'userData', 'api-endpoint.json') : join(homedir(), '.videostoryboard', 'api-endpoint.json'))
  if (!existsSync(file)) throw new Error(`Takt is not running (there is no ${file}). Open Takt, then run this again.`)
  const ep = JSON.parse(readFileSync(file, 'utf8'))
  if (ep.pid) {
    try {
      process.kill(ep.pid, 0)
    } catch {
      throw new Error(`Takt is not running (${file} is left from an earlier run). Open Takt, then run this again.`)
    }
  }
  return ep
}

export function client(ep) {
  return async (route, body) => {
    const res = await fetch(`${ep.url}/api/storyboard/${route}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${ep.token}`, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    })
    const json = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))
    if (json.ok) return json
    if (json.code === 'NO_ROUTE') throw new Error(`This Takt has no ${route} route yet: update Takt (it came with storyboard_footage_import).`)
    const err = new Error(`Takt ${route}: ${json.error ?? `HTTP ${res.status}`}`)
    err.code = json.code
    throw err
  }
}

/** The project a take goes in: one per PR, else one per branch. */
export function projectName(events) {
  if (events.project) return events.project
  const repo = events.git?.repo ?? 'QA'
  if (events.pr) return `${repo} #${events.pr.number}: ${events.pr.title}`.slice(0, 120)
  return `${repo}: ${events.git?.branch ?? events.title}`.slice(0, 120)
}

export async function send(bundle, { taktHome, render = true, log = console.log } = {}) {
  const events = JSON.parse(readFileSync(join(bundle, 'events.json'), 'utf8'))
  const api = client(endpoint({ taktHome }))
  const name = projectName(events)
  const { project, created } = await api('project/open', { name })
  log(`${created ? 'Made' : 'Opened'} the Takt project "${project.name}"`)

  const screen = join(bundle, 'screen.mp4')
  const imported = await api('footage/import', { paths: [screen], replace: true })
  if (imported.skipped.length) throw new Error(`Takt could not use ${screen}: ${imported.skipped[0].reason}`)
  log(`Put ${clock(imported.footageEndMs)} of recording on the footage track`)

  // Pinned to the recording (it starts at 0 after a replace), so they move with it when the waits are cut.
  const beats = events.beats
  const first = beats[0]?.startMs ?? 0
  const git = events.git
  const checks = beats.flatMap((b) => b.checks)
  const passed = checks.filter((c) => c.pass).length
  const graphics = [
    {
      kind: 'chapter',
      title: events.title.slice(0, 500),
      subtitle: [git?.repo, git?.branch, git?.sha?.slice(0, 7)].filter(Boolean).join(' · '),
      atMs: first + 100,
      durationMs: 3500
    },
    ...checkCallouts(checks)
  ]
  const last = beats.at(-1)
  if (checks.length && last) {
    graphics.push({
      kind: 'chapter',
      title: `${passed} of ${checks.length} checks passed`,
      subtitle: [git?.sha?.slice(0, 7), new Date(events.recordedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })].filter(Boolean).join(' · '),
      atMs: Math.max(first, last.voiceEndMs - 2500),
      durationMs: 3500
    })
  }
  for (const g of graphics) await api('graphic/add', g)
  log(`Added ${graphics.length} graphics: the title, ${checks.length} checks and the end card`)

  const words = await waitForWords(api, log)
  if (words) {
    const t = await api('footage/tighten', { longerThanMs: 1500, keepMs: 700 })
    log(`Tightened ${t.pauses + t.deadAir} waits (${(t.removedMs / 1000).toFixed(1)} s out)`)
  } else {
    log('No transcript yet, so the waits were left in: tighten them in Takt once it is ready')
  }

  let video = null
  if (render) {
    const { job } = await api('render/start', { quality: 'final' })
    video = await waitForRender(api, job.id, log)
    log(`Rendered ${video}`)
  }
  const handoff = { project: project.name, projectDir: project.dir, sourceId: imported.sources[0]?.sourceId, video, sentAt: new Date().toISOString() }
  writeFileSync(join(bundle, 'takt.json'), `${JSON.stringify(handoff, null, 2)}\n`)
  return handoff
}

/**
 * A callout for each check when it happened; checks that finish within a few ms of each other go one after another
 * in the same corner, each up long enough to read, rather than on top of each other.
 */
function checkCallouts(checks) {
  const STEP_MS = 1600
  const starts = []
  // Just after it shows (never before: tightening can cut the still moment that leads up to it).
  for (const c of checks) starts.push(Math.max(c.atMs + 50, starts.length ? starts.at(-1) + STEP_MS : 0))
  return checks.map((c, i) => ({
    kind: 'callout',
    title: (c.pass || !c.saw ? `${c.pass ? '✓' : '✗'} ${c.label}` : `✗ ${c.label}, saw “${c.saw}”`).slice(0, 500),
    position: 'top-right',
    atMs: starts[i],
    durationMs: i + 1 < checks.length ? Math.min(3500, starts[i + 1] - starts[i]) : 3500
  }))
}

/** Waits for Takt's own transcript of the recording (tighten and pinned words need it); false when it never comes. */
async function waitForWords(api, log, timeoutMs = 240_000) {
  let said = ''
  for (const end = Date.now() + timeoutMs; Date.now() < end; await sleep(3000)) {
    const t = await api('footage/transcript', {})
    if (!t.pending.length) return t.words > 0
    const state = t.pending.map((p) => p.state).join(', ')
    if (state !== said) log(`Waiting for Takt's transcript (${state})`)
    said = state
    if (t.pending.every((p) => p.state === 'none' || p.state === 'failed')) return false
  }
  return false
}

async function waitForRender(api, jobId, log, timeoutMs = 20 * 60_000) {
  let shown = -1
  for (const end = Date.now() + timeoutMs; Date.now() < end; await sleep(2000)) {
    const { job } = await api('render/status', { jobId })
    if (job.state === 'done') return job.outputPath
    if (job.state === 'failed' || job.state === 'cancelled') throw new Error(`Takt's render ${job.state}: ${job.error ?? job.message ?? ''}`)
    const pct = Math.floor(job.progress * 10) * 10
    if (pct !== shown) log(`Rendering ${pct}%`)
    shown = pct
  }
  throw new Error('Takt is still rendering after 20 minutes: look in its Render tab')
}

/** The open notes on the take's video, each placed back on the page: which beat, what was on screen, what was near. */
export async function notes(bundle, { taktHome, all = false } = {}) {
  const events = JSON.parse(readFileSync(join(bundle, 'events.json'), 'utf8'))
  const api = client(endpoint({ taktHome }))
  await api('project/open', { name: projectName(events), create: false })
  const { notes: list } = await api('notes/list', { all })
  const out = []
  for (const note of list) {
    let recordingMs = null
    let frame = null
    if (!note.cutAway) {
      try {
        const f = await api('footage/frame', { ms: note.atMs, maxEdge: 1280 })
        recordingMs = f.recordingMs
        frame = f.image.path
      } catch {
        // A note on a stretch with no recording (a title over nothing): it stays unplaced.
      }
    }
    out.push({ ...note, recordingMs, frame, place: recordingMs === null ? null : placeOn(events, recordingMs, note.marks) })
  }
  writeFileSync(join(bundle, 'notes.json'), `${JSON.stringify(out, null, 2)}\n`)
  return out
}

/** What the recording showed at `ms`: the beat, the page, the last thing done, and what each drawn mark landed on. */
function placeOn(events, ms, marks = []) {
  const beat = events.beats.find((b) => ms >= b.startMs && ms < b.endMs) ?? events.beats.findLast((b) => b.startMs <= ms) ?? null
  const url = events.navigations.findLast((n) => n.atMs <= ms)?.url ?? events.url ?? null
  const actions = events.beats.flatMap((b) => b.actions)
  const recent = actions.findLast((a) => a.startMs <= ms) ?? null
  const { width, height } = events.viewport
  const onPage = marks.map((m) => {
    const nums = (axis) => {
      const r = new RegExp(`${axis} ([0-9.]+)(?:–([0-9.]+))?`).exec(m.where)
      return r ? [Number(r[1]), Number(r[2] ?? r[1])] : null
    }
    const x = nums('x')
    const y = nums('y')
    if (!x || !y) return { label: m.label, where: m.where }
    const box = { x: Math.round(x[0] * width), y: Math.round(y[0] * height), width: Math.round((x[1] - x[0]) * width), height: Math.round((y[1] - y[0]) * height) }
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const hit = actions
      .filter((a) => a.box && Math.abs(a.startMs - ms) < 20_000)
      .find((a) => cx >= a.box.x - 12 && cx <= a.box.x + a.box.width + 12 && cy >= a.box.y - 12 && cy <= a.box.y + a.box.height + 12)
    return { label: m.label, kind: m.kind, pagePx: box, ...(hit ? { target: hit.target } : {}) }
  })
  return { beat: beat ? { n: beat.n, say: beat.say } : null, url, lastAction: recent ? { kind: recent.kind, target: recent.target, atMs: recent.startMs } : null, marks: onPage }
}

export async function noteDone(bundle, noteId, summary, { taktHome } = {}) {
  const events = JSON.parse(readFileSync(join(bundle, 'events.json'), 'utf8'))
  const api = client(endpoint({ taktHome }))
  await api('project/open', { name: projectName(events), create: false })
  return api('note/done', { noteId, summary })
}

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { basename, delimiter, join } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)

export const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)))

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/** Runs a tool and returns its stdout; when it fails, the error carries the end of its stderr. */
export async function run(cmd, args, opts = {}) {
  try {
    const { stdout } = await exec(cmd, args, { maxBuffer: 64 * 1024 * 1024, ...opts })
    return stdout
  } catch (err) {
    const why = String(err.stderr || err.message).trim().split('\n').slice(-3).join(' ')
    throw new Error(`${basename(cmd)} failed: ${why}`)
  }
}

export async function tryRun(cmd, args, opts) {
  try {
    return (await run(cmd, args, opts)).trim()
  } catch {
    return null
  }
}

/** A tool on PATH, or where Homebrew puts it. */
export function which(name) {
  const dirs = [...(process.env.PATH ?? '').split(delimiter), '/opt/homebrew/bin', '/usr/local/bin']
  for (const dir of dirs) if (dir && existsSync(join(dir, name))) return join(dir, name)
  return null
}

export function ffmpegTools() {
  const ffmpeg = which('ffmpeg')
  const ffprobe = which('ffprobe')
  if (!ffmpeg || !ffprobe) throw new Error('ffmpeg and ffprobe are needed: brew install ffmpeg')
  return { ffmpeg, ffprobe }
}

export async function durationMs(ffprobe, path) {
  const out = await run(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path])
  return Math.round(Number(out.trim()) * 1000)
}

/** The repo the take is about: its folder name, branch and commit. */
export async function gitInfo(cwd) {
  const root = await tryRun('git', ['rev-parse', '--show-toplevel'], { cwd })
  if (!root) return null
  const [branch, sha, dirty] = await Promise.all([
    tryRun('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd }),
    tryRun('git', ['rev-parse', 'HEAD'], { cwd }),
    tryRun('git', ['status', '--porcelain'], { cwd })
  ])
  return { repo: basename(root), root, branch, sha, dirty: Boolean(dirty) }
}

/** The open PR of the current branch, when gh knows one. */
export async function prInfo(cwd) {
  const out = await tryRun('gh', ['pr', 'view', '--json', 'number,title,url'], { cwd, timeout: 15_000 })
  try {
    return out ? JSON.parse(out) : null
  } catch {
    return null
  }
}

export const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'take'

/** 83 000 → "1:23". */
export const clock = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** The same random moves for the same take, so a re-take looks like the first. */
export function seeded(text) {
  let h = 2166136261
  for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

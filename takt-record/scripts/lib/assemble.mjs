/**
 * The screencast frames into a 1080p 30 fps H.264 file with the voice under it. Chromium sends a frame only when the
 * page repaints, so each frame is held until the next one; a still page costs nothing while recording.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { run } from './util.mjs'

/** A path as ffconcat reads it: single-quoted, a quote inside closed, escaped and reopened. */
const quote = (path) => `'${path.replace(/'/g, "'\\''")}'`

/** frames: { name, ms } in recording ms; voice: { path, atMs }[]. Writes narration.wav and screen.mp4 in `dir`. */
export async function assemble({ dir, framesDir, frames, endMs, voice, ffmpeg }) {
  if (!frames.length) throw new Error('The browser sent no frames: nothing was recorded')
  const sorted = [...frames].sort((a, b) => a.ms - b.ms)
  const start = Math.max(0, sorted.findLastIndex((f) => f.ms <= 0))
  const shown = sorted.slice(start).map((f, i) => ({ ...f, ms: i === 0 ? 0 : f.ms }))
  const lines = ['ffconcat version 1.0']
  for (const [i, f] of shown.entries()) {
    const next = i + 1 < shown.length ? shown[i + 1].ms : endMs
    if (next - f.ms <= 0) continue
    lines.push(`file ${quote(join(framesDir, f.name))}`, `duration ${((next - f.ms) / 1000).toFixed(4)}`)
  }
  lines.push(`file ${quote(join(framesDir, shown.at(-1).name))}`)
  const list = join(framesDir, 'frames.ffconcat')
  writeFileSync(list, `${lines.join('\n')}\n`)

  const seconds = (endMs / 1000).toFixed(3)
  const narration = join(dir, 'narration.wav')
  const placed = voice.filter(Boolean)
  const inputs = ['-f', 'lavfi', '-t', seconds, '-i', 'anullsrc=r=48000:cl=mono', ...placed.flatMap((v) => ['-i', v.path])]
  const graph = placed.length
    ? `${placed.map((v, i) => `[${i + 1}]adelay=${Math.max(0, Math.round(v.atMs))}:all=1[v${i}]`).join(';')};[0]${placed.map((_, i) => `[v${i}]`).join('')}amix=inputs=${placed.length + 1}:normalize=0:duration=first[out]`
    : '[0]anull[out]'
  await run(ffmpeg, ['-v', 'error', '-y', ...inputs, '-filter_complex', graph, '-map', '[out]', '-t', seconds, '-c:a', 'pcm_s16le', narration])

  const screen = join(dir, 'screen.mp4')
  await run(ffmpeg, [
    '-v', 'error', '-y',
    '-f', 'concat', '-safe', '0', '-i', list,
    '-i', narration,
    // Frames at 1080p or a pixel over (window rounding) are cropped, not resampled; bigger ones are scaled down.
    '-vf', 'scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080,fps=30,format=yuv420p',
    '-t', seconds,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16',
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart',
    screen
  ])
  return { screen, narration }
}

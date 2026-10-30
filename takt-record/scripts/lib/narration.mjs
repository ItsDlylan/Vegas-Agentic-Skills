/**
 * The voice: one macOS `say` clip per beat, at one loudness. Each clip is laid where its beat really started on
 * screen (assemble.mjs), so a slow page never pushes the words out of step with what they describe.
 */
import { join } from 'node:path'
import { durationMs, run } from './util.mjs'

/** The voice asked for when it is installed; else the best English one: Premium, then Enhanced, then Samantha. */
export async function pickVoice(wanted) {
  const list = await run('say', ['-v', '?'])
  const voices = list
    .split('\n')
    .map((line) => /^(.+?)\s{2,}([a-z]{2}_[A-Z]{2})\s+#/.exec(line))
    .filter(Boolean)
    .map(([, name, locale]) => ({ name: name.trim(), locale }))
  if (wanted) {
    const found = voices.find((v) => v.name.toLowerCase() === wanted.toLowerCase())
    if (found) return { name: found.name, note: null }
    return { name: best(voices), note: `the voice "${wanted}" is not installed` }
  }
  return { name: best(voices), note: null }
}

function best(voices) {
  const en = voices.filter((v) => v.locale === 'en_US' || v.locale === 'en_GB')
  return (
    en.find((v) => /\(Premium\)/.test(v.name))?.name ??
    en.find((v) => /\(Enhanced\)/.test(v.name))?.name ??
    voices.find((v) => v.name === 'Samantha')?.name ??
    en[0]?.name ??
    null
  )
}

/** Says each beat into dir/voice-<n>.wav (48 kHz mono, -16 LUFS); returns each clip and how long it is. */
export async function sayBeats(beats, { dir, voice, rate, ffmpeg, ffprobe }) {
  const clips = []
  for (const [i, beat] of beats.entries()) {
    if (!beat.say) {
      clips.push(null)
      continue
    }
    const aiff = join(dir, `voice-${i + 1}.aiff`)
    const wav = join(dir, `voice-${i + 1}.wav`)
    await run('say', [...(voice ? ['-v', voice] : []), '-r', String(rate), '-o', aiff, beat.say])
    await run(ffmpeg, ['-v', 'error', '-y', '-i', aiff, '-ar', '48000', '-ac', '1', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', wav])
    clips.push({ path: wav, ms: await durationMs(ffprobe, wav) })
  }
  return clips
}

/** When `phrase` is said in the beat's line, as a share of its length (said at an even pace). */
export function phraseAt(text, phrase, voiceMs) {
  const i = text.toLowerCase().indexOf(phrase.toLowerCase())
  if (i < 0) throw new Error(`"${phrase}" is not in the line "${text}"`)
  return Math.round((i / Math.max(1, text.length)) * voiceMs)
}

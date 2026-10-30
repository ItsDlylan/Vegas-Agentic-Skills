/**
 * The Chrome DevTools Protocol over Node's own WebSocket (Node 22+), so the recorder needs no npm install: one browser
 * connection, with the page as a flattened session on it.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { sleep } from './util.mjs'

export async function connect(url) {
  const ws = new WebSocket(url)
  await new Promise((ok, fail) => {
    ws.onopen = ok
    ws.onerror = () => fail(new Error(`Cannot reach the browser at ${url}`))
  })
  let id = 0
  const pending = new Map()
  const listeners = new Map()
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id !== undefined) {
      const call = pending.get(msg.id)
      pending.delete(msg.id)
      if (!call) return
      if (msg.error) call.fail(new Error(`${call.method}: ${msg.error.message}`))
      else call.ok(msg.result)
      return
    }
    for (const fn of listeners.get(`${msg.sessionId ?? ''} ${msg.method}`) ?? []) fn(msg.params)
  }
  ws.onclose = () => {
    for (const call of pending.values()) call.fail(new Error('The browser closed the connection'))
    pending.clear()
  }
  const send = (method, params = {}, sessionId) =>
    new Promise((ok, fail) => {
      const n = ++id
      pending.set(n, { ok, fail, method })
      ws.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) }))
    })
  const on = (method, fn, sessionId) => {
    const key = `${sessionId ?? ''} ${method}`
    if (!listeners.has(key)) listeners.set(key, new Set())
    listeners.get(key).add(fn)
    return () => listeners.get(key).delete(fn)
  }
  return { send, on, close: () => ws.close(), pageSocket: url.includes('/devtools/page/') }
}

/** The page as a session: send and on without repeating its session id. */
export function pageOf(conn, sessionId) {
  return {
    send: (method, params) => conn.send(method, params, sessionId),
    on: (method, fn) => conn.on(method, fn, sessionId)
  }
}

/** The newest Chromium in Playwright's cache (the headless shell unless `headed`), else Google Chrome. */
export function findChrome(headed) {
  if (process.env.TAKT_RECORD_CHROME) return process.env.TAKT_RECORD_CHROME
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, join(homedir(), 'Library/Caches/ms-playwright'), join(homedir(), '.cache/ms-playwright')]
  const prefix = headed ? 'chromium-' : 'chromium_headless_shell-'
  for (const root of roots) {
    if (!root || !existsSync(root)) continue
    const builds = readdirSync(root)
      .filter((d) => d.startsWith(prefix))
      .sort((a, b) => Number(b.split('-').pop()) - Number(a.split('-').pop()))
    for (const build of builds) {
      const dir = join(root, build)
      const candidates = headed
        ? [
            join(dir, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
            join(dir, 'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
            join(dir, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'),
            join(dir, 'chrome-linux/chrome')
          ]
        : [
            join(dir, 'chrome-headless-shell-mac-arm64/chrome-headless-shell'),
            join(dir, 'chrome-headless-shell-mac-x64/chrome-headless-shell'),
            join(dir, 'chrome-mac/headless_shell'),
            join(dir, 'chrome-linux/headless_shell')
          ]
      const found = candidates.find((c) => existsSync(c))
      if (found) return found
    }
  }
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  if (existsSync(chrome)) return chrome
  throw new Error('No Chromium found: run `npx playwright install chromium`, or set TAKT_RECORD_CHROME to a Chrome binary.')
}

/**
 * A Chromium of the recorder's own, with a throwaway profile; never the shared agent-browser daemon. It really runs at
 * `scale` (an emulated scale factor would not reach the screencast, which would then send CSS-pixel frames to upscale).
 */
export async function launch({ headed = false, insecure = false, width = 1600, height = 900, scale = 1.2 } = {}) {
  const bin = findChrome(headed)
  const profile = mkdtempSync(join(tmpdir(), 'takt-record-'))
  const args = [
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--mute-audio',
    '--force-color-profile=srgb',
    `--window-size=${width},${height}`,
    `--force-device-scale-factor=${scale}`,
    ...(insecure ? ['--ignore-certificate-errors'] : []),
    ...(headed ? [] : ['--headless']),
    'about:blank'
  ]
  const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] })
  const wsUrl = await new Promise((ok, fail) => {
    let err = ''
    const timer = setTimeout(() => fail(new Error(`Chromium did not start: ${err.slice(-400)}`)), 20_000)
    child.stderr.on('data', (d) => {
      err += d
      const m = err.match(/DevTools listening on (ws:\/\/\S+)/)
      if (m) {
        clearTimeout(timer)
        ok(m[1])
      }
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      fail(new Error(`Chromium exited (${code}): ${err.slice(-400)}`))
    })
  })
  const close = async () => {
    if (child.exitCode === null) {
      const exited = new Promise((r) => child.once('exit', r))
      child.kill()
      await Promise.race([exited, sleep(3000)])
    }
    rmSync(profile, { recursive: true, force: true })
  }
  return { wsUrl, close }
}

/** The browser socket of a Chromium already running: a port, http://host:port, or a ws:// URL. */
export async function browserSocket(cdp) {
  if (/^wss?:\/\//.test(cdp)) return cdp
  const base = /^\d+$/.test(String(cdp)) ? `http://127.0.0.1:${cdp}` : String(cdp).replace(/\/$/, '')
  const res = await fetch(`${base}/json/version`).catch(() => null)
  if (!res?.ok) throw new Error(`No browser answers on ${base} (is its CDP port right?)`)
  return (await res.json()).webSocketDebuggerUrl
}

/** Attaches to a page of the browser: the first whose URL contains `match`, else the first page. */
export async function attachPage(conn, match) {
  if (conn.pageSocket) return { sessionId: undefined, url: null }
  const { targetInfos } = await conn.send('Target.getTargets')
  const pages = targetInfos.filter((t) => (t.type === 'page' || t.type === 'webview') && !t.url.startsWith('devtools://'))
  const target = match ? pages.find((p) => p.url.includes(match)) : pages[0]
  if (!target) {
    const seen = pages.map((p) => p.url).join(', ') || 'none'
    throw new Error(match ? `No page's URL contains "${match}" (pages: ${seen})` : 'The browser has no page open')
  }
  const { sessionId } = await conn.send('Target.attachToTarget', { targetId: target.targetId, flatten: true })
  return { sessionId, url: target.url }
}

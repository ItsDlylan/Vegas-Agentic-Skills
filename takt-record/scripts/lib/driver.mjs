/**
 * Drives the page the way a person would, so the recording reads as someone using the app: the cursor travels on a
 * slight curve, slower over longer distances and onto smaller targets, rests on the target before it presses, and
 * typing comes a key at a time. `fast` (setup and rehearsal) skips the travel and the pauses, not the events.
 */
import { clamp, seeded, sleep } from './util.mjs'

const KEYS = {
  Enter: { code: 'Enter', keyCode: 13, text: '\r' },
  Tab: { code: 'Tab', keyCode: 9 },
  Escape: { code: 'Escape', keyCode: 27 },
  Backspace: { code: 'Backspace', keyCode: 8 },
  Delete: { code: 'Delete', keyCode: 46 },
  Space: { key: ' ', code: 'Space', keyCode: 32, text: ' ' },
  ArrowUp: { code: 'ArrowUp', keyCode: 38 },
  ArrowDown: { code: 'ArrowDown', keyCode: 40 },
  ArrowLeft: { code: 'ArrowLeft', keyCode: 37 },
  ArrowRight: { code: 'ArrowRight', keyCode: 39 },
  Home: { code: 'Home', keyCode: 36 },
  End: { code: 'End', keyCode: 35 },
  PageUp: { code: 'PageUp', keyCode: 33 },
  PageDown: { code: 'PageDown', keyCode: 34 }
}
const MODIFIERS = { Alt: 1, Control: 2, Ctrl: 2, Meta: 4, Cmd: 4, Shift: 8 }
const SYMBOLS = { Alt: '⌥', Control: '⌃', Ctrl: '⌃', Meta: '⌘', Cmd: '⌘', Shift: '⇧' }

/** Short enough for a callout. */
const short = (s) => (s.length > 40 ? `${s.slice(0, 39)}…` : s)

/** A target in words: “Save” for text=Save or label=Save, null for a CSS selector. */
export const quoted = (t) => (t.startsWith('text=') || t.startsWith('label=') ? `“${t.slice(t.indexOf('=') + 1)}”` : null)

/** What a check proves, when the take gives no label: words a viewer reads, never a CSS selector. */
export function checkLabel(c) {
  if ('see' in c) return quoted(c.see) ? `Shows ${quoted(c.see)}` : 'It shows'
  if ('notSee' in c) return quoted(c.notSee) ? `No ${quoted(c.notSee)}` : 'It is gone'
  if ('url' in c) return `The address has ${c.url}`
  if ('value' in c) return `${quoted(c.value) ?? 'The field'} ${c.is !== undefined ? 'is' : 'has'} “${c.is ?? c.has}”`
  if ('text' in c) return `${c.is !== undefined ? 'Says' : 'Has'} “${c.is ?? c.has}”`
  if ('count' in c) return `${c.is ?? (c.atLeast !== undefined ? `At least ${c.atLeast}` : `At most ${c.atMost}`)} showing`
  return 'Check'
}

export class Driver {
  constructor(page, { viewport, seed = 'take', fast = false }) {
    this.page = page
    this.viewport = viewport
    this.fast = fast
    this.random = seeded(seed)
    this.at = { x: Math.round(viewport.width * 0.62), y: Math.round(viewport.height * 0.58) }
    this.loading = false
    this.loaded = null
    page.on('Page.frameStartedLoading', (p) => {
      if (p.frameId === this.mainFrame) this.loading = true
    })
    page.on('Page.frameStoppedLoading', (p) => {
      if (p.frameId !== this.mainFrame) return
      this.loading = false
      this.loaded?.()
    })
  }

  async init() {
    const { frameTree } = await this.page.send('Page.getFrameTree')
    this.mainFrame = frameTree.frame.id
  }

  async eval(expression) {
    const { result, exceptionDetails } = await this.page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description?.split('\n')[0] ?? exceptionDetails.text)
    return result.value
  }

  takt(method, ...args) {
    return this.eval(`window.__takt ? window.__takt.${method}(...${JSON.stringify(args)}) : null`)
  }

  url() {
    return this.eval('location.href')
  }

  /** Waits out a navigation that started (a link, a form), then puts the drawn cursor back where the mouse is. */
  async settle() {
    await sleep(this.fast ? 60 : 150)
    if (this.loading) {
      await Promise.race([new Promise((r) => (this.loaded = r)), sleep(20_000)])
      this.loaded = null
      await sleep(this.fast ? 100 : 350)
    }
    await this.takt('at', this.at.x, this.at.y).catch(() => {})
  }

  async goto(url) {
    const { errorText, loaderId } = await this.page.send('Page.navigate', { url })
    if (errorText) throw new Error(`Cannot open ${url}: ${errorText}`)
    if (loaderId) {
      this.loading = true
      await Promise.race([new Promise((r) => (this.loaded = r)), sleep(30_000)])
      this.loaded = null
    }
    await sleep(this.fast ? 100 : 500)
    await this.takt('at', this.at.x, this.at.y)
  }

  /** The target on screen, scrolled into view first; throws with what is missing. */
  async reveal(target) {
    let box = null
    for (const end = Date.now() + 5000; ; await sleep(150)) {
      box = await this.takt('reveal', target)
      if (box || Date.now() > end) break
    }
    if (!box) throw new Error(`Cannot find ${target} on ${await this.url()}`)
    return box
  }

  async mouse(type, x, y, extra = {}) {
    await this.page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', ...extra })
  }

  /** Travels on a curve that bows to one side; Fitts' law for how long, eased in and out. */
  async moveTo(x, y, size = 40) {
    const from = { ...this.at }
    const to = { x: Math.round(x), y: Math.round(y) }
    const d = Math.hypot(to.x - from.x, to.y - from.y)
    if (this.fast || d < 3) {
      await this.mouse('mouseMoved', to.x, to.y)
      this.at = to
      return
    }
    const ms = clamp(230 + 130 * Math.log2(1 + d / Math.max(size, 24)), 280, 950)
    const bow = (0.06 + this.random() * 0.08) * d * (this.random() < 0.5 ? -1 : 1)
    const ctrl = { x: (from.x + to.x) / 2 - ((to.y - from.y) / d) * bow, y: (from.y + to.y) / 2 + ((to.x - from.x) / d) * bow }
    const steps = Math.max(8, Math.round(ms / 16))
    const t0 = Date.now()
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const k = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
      const px = (1 - k) ** 2 * from.x + 2 * (1 - k) * k * ctrl.x + k ** 2 * to.x
      const py = (1 - k) ** 2 * from.y + 2 * (1 - k) * k * ctrl.y + k ** 2 * to.y
      await this.mouse('mouseMoved', Math.round(px), Math.round(py))
      await sleep(t0 + (ms * i) / steps - Date.now())
    }
    this.at = to
  }

  /** Where to aim inside a box: near its middle, a little off, the way a hand lands (the overlay's inView keeps that clear). */
  aim(box) {
    const jx = (this.random() - 0.5) * Math.min(box.width * 0.3, 24)
    const jy = (this.random() - 0.5) * Math.min(box.height * 0.3, 8)
    return { x: box.x + box.width / 2 + jx, y: box.y + box.height / 2 + jy }
  }

  async click(target) {
    const box = await this.reveal(target)
    const p = this.aim(box)
    await this.moveTo(p.x, p.y, Math.min(box.width, box.height))
    await sleep(this.fast ? 0 : 130 + this.random() * 80)
    await this.mouse('mousePressed', this.at.x, this.at.y, { clickCount: 1, buttons: 1 })
    await sleep(this.fast ? 20 : 75)
    await this.mouse('mouseReleased', this.at.x, this.at.y, { clickCount: 1 })
    await this.settle()
    return box
  }

  async hover(target) {
    const box = await this.reveal(target)
    const p = this.aim(box)
    await this.moveTo(p.x, p.y, Math.min(box.width, box.height))
    await sleep(this.fast ? 50 : 450)
    return box
  }

  /** Presses the dropdown like a hand would, then picks the option (its own menu would not show in the recording). */
  async select(target, option) {
    const box = await this.click(target)
    const problem = await this.takt('choose', target, option)
    if (problem) throw new Error(problem)
    await sleep(this.fast ? 0 : 350)
    return box
  }

  async key(name, { show = true } = {}) {
    const parts = name.split('+')
    const main = parts.pop()
    const modifiers = parts.reduce((m, p) => m | (MODIFIERS[p] ?? 0), 0)
    const def = KEYS[main] ?? (main.length === 1 ? { key: main, code: /[a-z]/i.test(main) ? `Key${main.toUpperCase()}` : '', keyCode: main.toUpperCase().charCodeAt(0), text: main } : null)
    if (!def) throw new Error(`Unknown key "${main}" in "${name}"`)
    if (show && !this.fast && (modifiers || KEYS[main])) {
      await this.takt('key', [...parts.map((p) => SYMBOLS[p] ?? p), main.length === 1 ? main.toUpperCase() : main].join(' '))
    }
    const typed = modifiers & ~8 ? undefined : def.text
    const event = { key: def.key ?? main, code: def.code, windowsVirtualKeyCode: def.keyCode, modifiers }
    await this.page.send('Input.dispatchKeyEvent', { type: typed ? 'keyDown' : 'rawKeyDown', ...event, ...(typed ? { text: typed, unmodifiedText: typed } : {}) })
    await this.page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...event })
  }

  async press(name) {
    await this.key(name)
    await this.settle()
  }

  async type(target, text, { clear = false } = {}) {
    const box = await this.click(target)
    if (clear) {
      await this.takt('selectAll', target)
      await this.key('Backspace', { show: false })
    }
    for (const ch of text) {
      await this.page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch, unmodifiedText: ch })
      await this.page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch })
      if (!this.fast) await sleep(ch === ' ' ? 110 + this.random() * 60 : 55 + this.random() * 70)
    }
    return box
  }

  async scroll(to) {
    if (typeof to === 'number') await this.takt('scrollBy', to)
    else return this.reveal(to)
    return null
  }

  async waitFor(target, timeoutMs = 10_000) {
    for (const end = Date.now() + timeoutMs; ; await sleep(150)) {
      if (await this.takt('box', target)) return
      if (Date.now() > end) throw new Error(`${target} did not show on ${await this.url()} within ${timeoutMs} ms`)
    }
  }

  async waitForUrl(part, timeoutMs = 15_000) {
    for (const end = Date.now() + timeoutMs; ; await sleep(150)) {
      const url = await this.url()
      if (url.includes(part)) return
      if (Date.now() > end) throw new Error(`The URL never had ${part} (it is ${url})`)
    }
  }

  /** One check, tried until it holds or its time runs out; what it looked at is outlined green or red on screen. */
  async check(c) {
    const timeoutMs = c.timeoutMs ?? 4000
    let last
    for (const end = Date.now() + timeoutMs; ; await sleep(200)) {
      last = await this.probe(c)
      if (last.pass || Date.now() > end) break
    }
    const label = c.label ?? checkLabel(c)
    if (!this.fast) {
      if (last.box) await this.takt('flash', last.box, last.pass)
      else if (!last.pass) await this.takt('fail', last.saw !== undefined ? `${label}: saw “${last.saw}”` : label)
    }
    return {
      label,
      pass: last.pass,
      actual: last.actual,
      ...(!last.pass && last.saw !== undefined ? { saw: last.saw } : {}),
      ...(last.box ? { box: last.box } : {})
    }
  }

  async probe(c) {
    if ('see' in c) {
      const box = await this.takt('reveal', c.see)
      return { pass: Boolean(box), actual: box ? 'on screen' : 'not on the page', box }
    }
    if ('notSee' in c) {
      const box = await this.takt('box', c.notSee)
      return { pass: !box, actual: box ? 'on screen' : 'not on screen', box }
    }
    if ('url' in c) {
      const url = await this.url()
      const { pathname, search } = new URL(url)
      return { pass: url.includes(c.url), actual: url, saw: short(pathname + search) }
    }
    const target = c.value ?? c.text ?? c.count
    const box = await this.takt('reveal', target)
    if ('count' in c) {
      const n = await this.takt('count', target)
      const pass = (c.is === undefined || n === c.is) && (c.atLeast === undefined || n >= c.atLeast) && (c.atMost === undefined || n <= c.atMost)
      return { pass, actual: String(n), saw: String(n), box }
    }
    const got = await this.takt('value' in c ? 'value' : 'text', target)
    if (got === null) return { pass: false, actual: 'not on the page', box }
    const pass = c.is !== undefined ? got === c.is : got.includes(c.has ?? '')
    return { pass, actual: got.slice(0, 160), saw: short(got), box }
  }
}

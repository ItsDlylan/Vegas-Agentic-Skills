/**
 * What the recorder adds to the page: a drawn cursor that follows the real mouse events (a headless page draws none),
 * a ring where it presses, a chip for each shortcut, a green or red outline on what a check looked at, and the element
 * finder the driver uses. It runs in every new document of the page (Page.addScriptToEvaluateOnNewDocument), so it
 * survives navigations, and stays outside <body> so apps that swap the body (Turbo, Inertia) keep it.
 *
 * `overlay` is serialised into the page: it must not use anything from this module.
 */
export function overlay(config) {
  if (window.__takt || window.top !== window) return
  const ACCENT = 'rgba(124, 92, 255, 0.95)'
  const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()
  let root, cursor, ring, chips
  let off = false
  const pos = { x: -100, y: -100 }

  const style = document.createElement('style')
  style.textContent = [
    config.hide.length ? `${config.hide.join(', ')} { visibility: hidden !important; }` : '',
    config.redact.length ? `${config.redact.join(', ')} { filter: blur(10px) !important; }` : '',
    '::-webkit-scrollbar { display: none; }'
  ].join('\n')

  const el = (tag, css) => {
    const node = document.createElement(tag)
    Object.assign(node.style, css)
    return node
  }

  const mount = () => {
    if (off || root?.isConnected) return
    const host = document.documentElement
    if (!host) return
    root = el('div', { position: 'fixed', inset: '0', zIndex: '2147483647', pointerEvents: 'none', margin: '0', padding: '0' })
    root.id = '__takt-root'
    ring = el('div', {
      position: 'absolute', left: '-22px', top: '-22px', width: '44px', height: '44px', borderRadius: '50%',
      border: `3px solid ${ACCENT}`, opacity: '0', boxSizing: 'border-box'
    })
    cursor = el('div', { position: 'absolute', left: '0', top: '0', width: '30px', height: '30px', transform: 'translate(-100px, -100px)', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.45))', transition: 'scale .08s' })
    cursor.innerHTML =
      '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.5 15 L11.5 22 L14.5 20.7 L11.6 14 L18 14 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    chips = el('div', { position: 'absolute', left: '0', right: '0', bottom: '48px', display: 'flex', justifyContent: 'center', gap: '10px' })
    root.append(ring, cursor, chips)
    host.append(style, root)
    place()
  }

  const place = () => {
    if (cursor) cursor.style.transform = `translate(${pos.x - 4}px, ${pos.y - 2}px)`
  }

  addEventListener('mousemove', (e) => { pos.x = e.clientX; pos.y = e.clientY; mount(); place() }, true)
  addEventListener('mousedown', (e) => {
    mount()
    cursor.style.scale = '0.86'
    ring.style.transition = 'none'
    ring.style.transform = `translate(${e.clientX}px, ${e.clientY}px) scale(.35)`
    ring.style.opacity = '1'
    requestAnimationFrame(() => requestAnimationFrame(() => {
      ring.style.transition = 'transform .45s ease-out, opacity .45s ease-out'
      ring.style.transform = `translate(${e.clientX}px, ${e.clientY}px) scale(1.5)`
      ring.style.opacity = '0'
    }))
  }, true)
  addEventListener('mouseup', () => { if (cursor) cursor.style.scale = '1' }, true)
  document.addEventListener('DOMContentLoaded', mount)
  const remount = setInterval(mount, 500)
  mount()

  // ── finding things ──
  const inOverlay = (node) => root?.contains(node)
  const visible = (node) => {
    const r = node.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    const cs = getComputedStyle(node)
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05
  }
  const textMatcher = (want) => {
    const re = /^\/(.*)\/([a-z]*)$/.exec(want)
    if (re) {
      const rx = new RegExp(re[1], re[2])
      return (s) => rx.test(s)
    }
    const exact = norm(want)
    return (s) => s === exact
  }
  const all = (target) => {
    if (target.startsWith('text=')) {
      const test = textMatcher(target.slice(5))
      const hits = []
      const walker = document.createTreeWalker(document.body ?? document.documentElement, NodeFilter.SHOW_ELEMENT)
      for (let node = walker.currentNode; node; node = walker.nextNode()) {
        if (node === root || node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || inOverlay(node)) continue
        const own = node.matches('input[type=submit], input[type=button]') ? node.value : node.textContent
        if (test(norm(own))) hits.push(node)
      }
      return hits.filter((node) => !hits.some((other) => other !== node && node.contains(other)))
    }
    if (target.startsWith('label=')) {
      const want = norm(target.slice(6))
      const found = new Set()
      for (const label of document.querySelectorAll('label')) {
        if (norm(label.textContent) !== want) continue
        const control = label.control ?? label.querySelector('input, textarea, select')
        if (control) found.add(control)
      }
      for (const node of document.querySelectorAll('input, textarea, select, [contenteditable], [role=textbox], [role=combobox]')) {
        if (norm(node.getAttribute('aria-label')) === want || norm(node.getAttribute('placeholder')) === want) found.add(node)
      }
      return [...found]
    }
    return [...document.querySelectorAll(target)].filter((node) => !inOverlay(node))
  }
  const find = (target) => {
    const nodes = all(target)
    return nodes.find(visible) ?? null
  }
  const rect = (node) => {
    const r = node.getBoundingClientRect()
    return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }
  }
  const scrollerOf = (node) => {
    for (let p = node.parentElement; p; p = p.parentElement) {
      const oy = getComputedStyle(p).overflowY
      if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 2) return p
    }
    return document.scrollingElement ?? document.documentElement
  }
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2)
  const animate = (box, to) =>
    new Promise((done) => {
      const from = box.scrollTop
      to = Math.max(0, Math.min(to, box.scrollHeight - box.clientHeight))
      const distance = Math.abs(to - from)
      if (distance < 2) return done()
      const ms = Math.min(1200, Math.max(400, 350 + distance * 0.45))
      const behavior = box.style.scrollBehavior
      box.style.scrollBehavior = 'auto'
      const t0 = performance.now()
      const step = (now) => {
        const k = Math.min(1, (now - t0) / ms)
        box.scrollTop = from + (to - from) * ease(k)
        if (k < 1) requestAnimationFrame(step)
        else {
          box.style.scrollBehavior = behavior
          done()
        }
      }
      requestAnimationFrame(step)
    })
  const inView = (node) => {
    const r = node.getBoundingClientRect()
    return r.top >= 60 && r.bottom <= innerHeight - 60
  }

  window.__takt = {
    /** Leaves the page as it was (attached to someone else's browser). */
    off() {
      off = true
      clearInterval(remount)
      root?.remove()
      style.remove()
      delete window.__takt
    },
    at(x, y) {
      pos.x = x
      pos.y = y
      mount()
      place()
    },
    key(label, failed = false) {
      mount()
      const chip = el('div', {
        font: '600 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#fff',
        background: failed ? 'rgba(185,28,28,.94)' : 'rgba(17,17,17,.88)', border: '1px solid rgba(255,255,255,.18)', borderRadius: '12px',
        padding: '10px 18px', letterSpacing: '0.02em', boxShadow: '0 6px 24px rgba(0,0,0,.35)', opacity: '0', transform: 'translateY(8px)',
        transition: 'opacity .18s, transform .18s'
      })
      chip.textContent = label
      chips.append(chip)
      const upMs = failed ? 2400 : 1100
      requestAnimationFrame(() => { chip.style.opacity = '1'; chip.style.transform = 'none' })
      setTimeout(() => { chip.style.opacity = '0' }, upMs)
      setTimeout(() => chip.remove(), upMs + 300)
    },
    /** A failure with nothing to outline (a target that never showed, a wrong address): a red chip, so it is on screen. */
    fail(label) {
      this.key(`✗ ${label}`, true)
    },
    flash(box, ok) {
      mount()
      const color = ok ? '#22c55e' : '#ef4444'
      const frame = el('div', {
        position: 'absolute', left: `${box.x - 6}px`, top: `${box.y - 6}px`, width: `${box.width + 12}px`, height: `${box.height + 12}px`,
        border: `3px solid ${color}`, borderRadius: '10px', boxShadow: `0 0 0 4px ${color}33`, boxSizing: 'border-box', opacity: '0', transition: 'opacity .2s'
      })
      const badge = el('div', {
        position: 'absolute', right: '-13px', top: '-13px', width: '26px', height: '26px', borderRadius: '50%', background: color, color: '#fff',
        font: '700 16px -apple-system, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center'
      })
      badge.textContent = ok ? '✓' : '✗'
      frame.append(badge)
      root.append(frame)
      requestAnimationFrame(() => { frame.style.opacity = '1' })
      setTimeout(() => { frame.style.opacity = '0' }, 1500)
      setTimeout(() => frame.remove(), 1800)
    },
    box(target) {
      const node = find(target)
      return node ? rect(node) : null
    },
    count(target) {
      return all(target).filter(visible).length
    },
    /** Scrolls what holds the target (and then the page, when that is not enough) so it sits a third of the way down. */
    async reveal(target) {
      const node = find(target)
      if (!node) return null
      for (let pass = 0; pass < 2 && !inView(node); pass++) {
        const box = pass === 0 ? scrollerOf(node) : document.scrollingElement ?? document.documentElement
        const top = box === document.scrollingElement || box === document.documentElement ? 0 : box.getBoundingClientRect().top
        const height = top === 0 ? innerHeight : box.clientHeight
        await animate(box, box.scrollTop + (node.getBoundingClientRect().top - top) - 0.33 * height)
      }
      return rect(node)
    },
    scrollBy(dy) {
      const box = document.scrollingElement ?? document.documentElement
      return animate(box, box.scrollTop + dy)
    },
    value(target) {
      const node = find(target) ?? all(target)[0]
      if (!node) return null
      return 'value' in node && typeof node.value === 'string' ? node.value : norm(node.innerText ?? node.textContent)
    },
    text(target) {
      const node = find(target) ?? all(target)[0]
      return node ? norm(node.innerText ?? node.textContent) : null
    },
    /** Selects what the field holds, so the next key replaces it. */
    selectAll(target) {
      const node = find(target)
      if (!node) return false
      node.focus()
      if (typeof node.select === 'function') node.select()
      else {
        const range = document.createRange()
        range.selectNodeContents(node)
        const sel = getSelection()
        sel.removeAllRanges()
        sel.addRange(range)
      }
      return true
    }
  }
}

/** The script that installs the overlay with this take's config. */
export const overlaySource = (config) => `(${overlay.toString()})(${JSON.stringify(config)})`

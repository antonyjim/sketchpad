type Tool = 'pen' | 'marker' | 'glow' | 'spray' | 'fill' | 'eraser'
type Point = { x: number, y: number }

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!
const ctx = canvas.getContext('2d', { willReadFrequently: true })!
const colorWheel = document.querySelector<HTMLElement>('#color-wheel')!
const colorPreview = document.querySelector<HTMLElement>('#color-preview')!
const sizeInput = document.querySelector<HTMLInputElement>('#brush-size')!
const sizeButton = document.querySelector<HTMLButtonElement>('#size-toggle')!
const sizePanel = document.querySelector<HTMLElement>('#size-panel')!
const sizePreview = document.querySelector<HTMLElement>('#size-preview')!
const toolButtons = document.querySelectorAll<HTMLButtonElement>('[data-tool]')
const paper = '#f4f3f9'

let tool: Tool = 'pen'
let color = '#7657ec'
let brushSize = 12
const pointers = new Map<number, { last: Point, tool: Tool, color: string, size: number }>()
let ratio = 1
let width = 0
let height = 0

function resize() {
  const w = window.innerWidth
  const h = window.innerHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (w === width && h === height && dpr === ratio) return

  const previous = document.createElement('canvas')
  previous.width = canvas.width
  previous.height = canvas.height
  if (previous.width && previous.height) previous.getContext('2d')!.drawImage(canvas, 0, 0)

  width = w
  height = h
  ratio = dpr
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, w, h)
  if (previous.width && previous.height) {
    ctx.drawImage(previous, 0, 0, previous.width, previous.height, 0, 0, previous.width / dpr, previous.height / dpr)
  }
}

function point(event: PointerEvent): Point {
  return { x: event.clientX, y: event.clientY }
}

function setupStroke(brush: Tool, ink: string, size: number) {
  ctx.globalCompositeOperation = 'source-over'
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (brush === 'pen') {
    ctx.strokeStyle = ink
    ctx.fillStyle = ink
    ctx.lineWidth = size * 0.3
  } else if (brush === 'marker') {
    ctx.strokeStyle = ink
    ctx.fillStyle = ink
    ctx.lineWidth = size * 1.5
    ctx.globalAlpha = 0.2
  } else if (brush === 'glow') {
    ctx.strokeStyle = ink
    ctx.fillStyle = ink
    ctx.lineWidth = size * 0.5
    ctx.shadowColor = ink
    ctx.shadowBlur = size * 1.3
  } else if (brush === 'eraser') {
    ctx.strokeStyle = paper
    ctx.fillStyle = paper
    ctx.lineWidth = size * 2.5
  }
}

function spray(from: Point, to: Point, ink: string, size: number) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  const steps = Math.max(1, Math.ceil(distance / Math.max(1, size / 4)))
  ctx.save()
  ctx.fillStyle = ink
  ctx.globalAlpha = 0.65
  for (let step = 0; step < steps; step++) {
    const t = (step + 1) / steps
    const x = from.x + (to.x - from.x) * t
    const y = from.y + (to.y - from.y) * t
    for (let i = 0; i < 9; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = Math.sqrt(Math.random()) * size * 1.3
      ctx.beginPath()
      ctx.arc(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, Math.max(0.3, size * 0.045) + Math.random() * size * 0.06, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function stroke(from: Point, to: Point, brush: Tool, ink: string, size: number) {
  if (brush === 'spray') {
    spray(from, to, ink, size)
    return
  }
  ctx.save()
  setupStroke(brush, ink, size)
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
  ctx.restore()
}

function dot(at: Point, brush: Tool, ink: string, size: number) {
  if (brush === 'spray') {
    spray(at, at, ink, size)
    return
  }
  ctx.save()
  setupStroke(brush, ink, size)
  ctx.beginPath()
  ctx.arc(at.x, at.y, ctx.lineWidth / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

// Scanline flood fill: avoids a large per-pixel object queue or recursive stack.
function fill(at: Point) {
  const w = canvas.width
  const h = canvas.height
  const sx = Math.floor(at.x * ratio)
  const sy = Math.floor(at.y * ratio)
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return

  const image = ctx.getImageData(0, 0, w, h)
  const pixels = image.data
  const start = (sy * w + sx) * 4
  const target = [pixels[start], pixels[start + 1], pixels[start + 2], pixels[start + 3]]
  const next = rgb(color)
  if (target[3] === 255 && next.every((v, i) => Math.abs(v - target[i]) < 12)) return

  const tolerance = 24
  const matches = (index: number) =>
    Math.abs(pixels[index] - target[0]) <= tolerance &&
    Math.abs(pixels[index + 1] - target[1]) <= tolerance &&
    Math.abs(pixels[index + 2] - target[2]) <= tolerance &&
    Math.abs(pixels[index + 3] - target[3]) <= tolerance

  const visited = new Uint8Array(w * h)
  const stack: number[] = [sy * w + sx]

  while (stack.length) {
    const seed = stack.pop()!
    const y = Math.floor(seed / w)
    let x = seed % w
    let idx = y * w + x
    if (visited[idx] || !matches(idx * 4)) continue

    while (x > 0 && !visited[idx - 1] && matches((idx - 1) * 4)) {
      x--
      idx--
    }

    let above = false
    let below = false
    while (x < w && !visited[idx] && matches(idx * 4)) {
      visited[idx] = 1
      const p = idx * 4
      pixels[p] = next[0]
      pixels[p + 1] = next[1]
      pixels[p + 2] = next[2]
      pixels[p + 3] = 255

      if (y > 0) {
        const a = idx - w
        const hit = !visited[a] && matches(a * 4)
        if (hit && !above) stack.push(a)
        above = hit
      }
      if (y < h - 1) {
        const b = idx + w
        const hit = !visited[b] && matches(b * 4)
        if (hit && !below) stack.push(b)
        below = hit
      }
      x++
      idx++
    }
  }
  ctx.putImageData(image, 0, 0)
}

canvas.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  event.preventDefault()
  const at = point(event)
  if (tool === 'fill') {
    fill(at)
    return
  }
  pointers.set(event.pointerId, { last: at, tool, color, size: brushSize })
  canvas.setPointerCapture(event.pointerId)
  dot(at, tool, color, brushSize)
})

canvas.addEventListener('pointermove', event => {
  const pointer = pointers.get(event.pointerId)
  if (!pointer) return
  event.preventDefault()
  const events = event.getCoalescedEvents?.() ?? [event]
  for (const e of events) {
    const next = point(e)
    stroke(pointer.last, next, pointer.tool, pointer.color, pointer.size)
    pointer.last = next
  }
})

function stop(event: PointerEvent) {
  if (!pointers.delete(event.pointerId)) return
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
}
canvas.addEventListener('pointerup', stop)
canvas.addEventListener('pointercancel', stop)
canvas.addEventListener('lostpointercapture', event => pointers.delete(event.pointerId))
canvas.addEventListener('contextmenu', event => event.preventDefault())
document.addEventListener('selectstart', event => event.preventDefault())

// The visible wheel is the color picker. A single tap selects its hue.
// The middle displays the currently selected color without opening a dialog.
colorWheel.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  event.preventDefault()
  const bounds = colorWheel.getBoundingClientRect()
  const dx = event.clientX - (bounds.left + bounds.width / 2)
  const dy = event.clientY - (bounds.top + bounds.height / 2)
  if (Math.hypot(dx, dy) < bounds.width * 0.18) return
  const hue = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360
  color = hslToHex(hue, 95, 58)
  colorPreview.style.background = color
})

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const component = (n: number) => {
    const k = (n + h / 30) % 12
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * value).toString(16).padStart(2, '0')
  }
  return `#${component(0)}${component(8)}${component(4)}`
}

sizeButton.addEventListener('click', () => {
  const open = sizePanel.hidden
  sizePanel.hidden = !open
  sizeButton.setAttribute('aria-expanded', String(open))
})

sizeInput.addEventListener('input', () => {
  brushSize = Number(sizeInput.value)
  sizePreview.style.width = `${brushSize}px`
  sizePreview.style.height = `${brushSize}px`
  sizeInput.setAttribute('aria-valuetext', `${brushSize} pixels`)
})

toolButtons.forEach(button => {
  button.addEventListener('click', () => {
    tool = button.dataset.tool as Tool
    toolButtons.forEach(other => {
      const selected = other === button
      other.classList.toggle('active', selected)
      other.setAttribute('aria-pressed', String(selected))
    })
  })
})

document.querySelector<HTMLButtonElement>('#clear')!.addEventListener('click', () => {
  ctx.save()
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
})

window.addEventListener('resize', resize)
resize()

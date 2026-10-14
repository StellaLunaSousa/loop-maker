import type { Compiled } from '../music/compose'
import { sectionChords } from '../music/compose'
import { SECTION_LABEL } from '../music/presets'
import { chordLabel } from '../music/theory'
import { STEPS_PER_BAR, STEPS_PER_SECTION, type LaneId, type NoteEvent, type Song } from '../music/types'

export const LANE_COLORS: Record<Song['console'], Record<LaneId, string>> = {
  nes: { drums: '#ff4f4f', bass: '#4f8bff', chords: '#3fd47a', melody: '#ffd23f' },
  psx: { drums: '#ff7a9c', bass: '#55d6cc', chords: '#a990ff', melody: '#ffc773' },
}

export interface Scene {
  song: Song
  compiled: Compiled
}

const LANE_ORDER: LaneId[] = ['melody', 'chords', 'bass', 'drums']
const PITCH_RANGE: Record<LaneId, [number, number]> = { melody: [58, 98], chords: [50, 82], bass: [26, 66], drums: [0, 8] }
const DRUM_ROW: Record<string, number> = { kick: 0, tomLo: 1, tomMid: 2, snare: 3, tomHi: 4, hat: 5, openhat: 6, crash: 7 }

const BEHIND = 20
const AHEAD = 44

function visible(compiled: Compiled, stepF: number): NoteEvent[] {
  const lo = stepF - BEHIND - 16
  const hi = stepF + AHEAD
  return compiled.events.filter((e) => e.step + e.len >= lo && e.step <= hi)
}

function currentInfo(scene: Scene, stepF: number) {
  const { song } = scene
  const step = Math.max(0, Math.floor(stepF))
  const col = Math.min(song.order.length - 1, Math.floor(step / STEPS_PER_SECTION))
  const bar = Math.floor((step % STEPS_PER_SECTION) / STEPS_PER_BAR)
  const type = song.order[col]
  return { col, type, section: SECTION_LABEL[type], chord: chordLabel(sectionChords(song, type)[bar], song.vibe, song.key) }
}

/** How hard the most recent kick (or crash) is still "hitting", 0–1. */
function pulse(scene: Scene, stepF: number): number {
  let best = 0
  for (let s = Math.floor(stepF); s > stepF - 3 && s >= 0; s--) {
    for (const e of scene.compiled.byStep[s] ?? []) {
      if (e.drum === 'kick' || e.drum === 'crash') best = Math.max(best, Math.max(0, 1 - (stepF - s) / 3) * e.vel)
    }
  }
  return best
}

let lowRes: HTMLCanvasElement | OffscreenCanvas | null = null

/** Draws one frame. Pure function of the song and the time, so export matches preview. */
export function drawFrame(target: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, w: number, h: number, scene: Scene, stepF: number) {
  if (scene.song.console === 'nes') drawNes(target, w, h, scene, stepF)
  else drawPsx(target, w, h, scene, stepF)
}

function roll(
  x0: number, y0: number, w: number, h: number, scene: Scene, stepF: number,
  draw: (lane: LaneId, x: number, y: number, bw: number, bh: number, lit: boolean, color: string) => void,
) {
  const colors = LANE_COLORS[scene.song.console]
  const pxPerStep = w / (BEHIND + AHEAD)
  const nowX = x0 + BEHIND * pxPerStep
  const bandH = h / LANE_ORDER.length
  for (const e of visible(scene.compiled, stepF)) {
    const band = LANE_ORDER.indexOf(e.lane)
    const [lo, hi] = PITCH_RANGE[e.lane]
    const x = nowX + (e.step - stepF) * pxPerStep
    const bw = Math.max(pxPerStep * 0.8, e.len * pxPerStep - pxPerStep * 0.2)
    const lit = e.step <= stepF && e.step + e.len > stepF
    const values = e.drum ? [DRUM_ROW[e.drum] ?? 0] : e.notes
    for (const n of values) {
      const p = (n - lo) / (hi - lo)
      const y = y0 + band * bandH + (1 - Math.min(1, Math.max(0, p))) * (bandH * 0.8) + bandH * 0.05
      draw(e.lane, x, y, e.drum ? pxPerStep * 0.8 : bw, Math.max(2, bandH / 11), lit, colors[e.lane])
    }
  }
  return nowX
}

function drawNes(target: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, w: number, h: number, scene: Scene, stepF: number) {
  // Draw at a low resolution and scale up without smoothing: real pixels.
  const px = Math.max(2, Math.round(Math.min(w, h) / 200))
  const lw = Math.ceil(w / px)
  const lh = Math.ceil(h / px)
  if (!lowRes || lowRes.width !== lw || lowRes.height !== lh) {
    lowRes = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(lw, lh) : Object.assign(document.createElement('canvas'), { width: lw, height: lh })
  }
  const g = lowRes.getContext('2d') as CanvasRenderingContext2D
  g.imageSmoothingEnabled = false
  g.fillStyle = '#0d0d12'
  g.fillRect(0, 0, lw, lh)

  const kick = pulse(scene, stepF)
  const info = currentInfo(scene, stepF)
  const portrait = lh > lw
  const pad = Math.round(Math.min(lw, lh) * 0.07)

  // Starfield that drifts with the music.
  for (let i = 0; i < 60; i++) {
    const sx = (i * 97 + Math.floor(stepF * (1 + (i % 3)))) % lw
    const sy = (i * 53) % lh
    g.fillStyle = i % 7 === 0 ? '#ffd23f' : '#3a3a55'
    g.fillRect(lw - sx, sy, 1, 1)
  }

  const titleSize = Math.max(6, Math.round(Math.min(lw, lh) * (portrait ? 0.06 : 0.07)))
  g.font = `${titleSize}px "Press Start 2P", monospace`
  g.textBaseline = 'top'
  g.fillStyle = '#ffffff'
  const title = scene.song.title.toUpperCase()
  wrapText(g, title, pad, pad, lw - pad * 2, titleSize * 1.4, 2)

  const small = Math.max(5, Math.round(titleSize * 0.5))
  g.font = `${small}px "Press Start 2P", monospace`
  g.fillStyle = '#ff4f4f'
  g.fillText(`${info.section.toUpperCase()}  ${info.chord}`, pad, pad + titleSize * 3.2)

  const rollY = portrait ? lh * 0.3 : lh * 0.36
  const rollH = portrait ? lh * 0.52 : lh * 0.5
  const nowX = roll(0, rollY, lw, rollH, scene, stepF, (_lane, x, y, bw, bh, lit, color) => {
    g.fillStyle = lit ? '#ffffff' : color
    g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(bw)), Math.max(1, Math.round(bh)))
    if (lit) {
      g.fillStyle = color
      g.fillRect(Math.round(x), Math.round(y + bh), Math.max(1, Math.round(bw)), 1)
    }
  })
  g.fillStyle = kick > 0.3 ? '#ffffff' : '#555570'
  for (let y = rollY; y < rollY + rollH; y += 3) g.fillRect(Math.round(nowX), Math.round(y), 1, 2)

  // Section strip.
  const stripY = lh - pad - small * 2
  const n = scene.song.order.length
  const cw = (lw - pad * 2) / n
  scene.song.order.forEach((_t, i) => {
    g.fillStyle = i === info.col ? '#ffd23f' : '#2a2a3a'
    g.fillRect(Math.round(pad + i * cw), Math.round(stripY), Math.max(1, Math.round(cw - 2)), Math.max(2, Math.round(small * 0.6)))
  })
  g.fillStyle = '#8888aa'
  g.fillText('LOOP MAKER', pad, stripY + small)

  target.imageSmoothingEnabled = false
  target.drawImage(lowRes as CanvasImageSource, 0, 0, lw * px, lh * px)
  // Scanlines.
  target.fillStyle = 'rgba(0,0,0,0.18)'
  for (let y = 0; y < h; y += px * 2) target.fillRect(0, y, w, Math.max(1, Math.floor(px / 2)))
}

function drawPsx(g: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, w: number, h: number, scene: Scene, stepF: number) {
  const kick = pulse(scene, stepF)
  const info = currentInfo(scene, stepF)
  const portrait = h > w
  const m = Math.min(w, h)
  const pad = m * 0.07

  const bg = g.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#0a0f24')
  bg.addColorStop(1, '#1d1440')
  g.fillStyle = bg
  g.fillRect(0, 0, w, h)

  // A low-poly gem that spins and wobbles, like an early 3D title screen.
  const cx = w / 2
  const cy = portrait ? h * 0.36 : h * 0.42
  const r = m * (portrait ? 0.24 : 0.2) * (1 + kick * 0.08)
  const a = stepF * 0.035
  const verts: [number, number, number][] = []
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + a
    verts.push([Math.cos(ang), 0, Math.sin(ang)])
  }
  const top: [number, number, number] = [0, -1.2, 0]
  const bot: [number, number, number] = [0, 1.2, 0]
  const proj = ([x, y, z]: [number, number, number]) => {
    const tilt = 0.35
    const y2 = y * Math.cos(tilt) - z * Math.sin(tilt)
    const z2 = y * Math.sin(tilt) + z * Math.cos(tilt)
    const s = 1 / (1 + z2 * 0.25)
    // Snap to a coarse grid: the vertex jitter of early 3D hardware.
    const snap = m / 160
    return [Math.round((cx + x * r * s) / snap) * snap, Math.round((cy + y2 * r * s) / snap) * snap, z2] as const
  }
  const colors = LANE_COLORS.psx
  const faces: { pts: (readonly [number, number, number])[]; depth: number; color: string }[] = []
  for (let i = 0; i < 6; i++) {
    const v1 = verts[i]
    const v2 = verts[(i + 1) % 6]
    for (const [tip, color] of [[top, i % 2 ? colors.chords : colors.melody], [bot, i % 2 ? colors.bass : colors.drums]] as const) {
      const pts = [proj(tip), proj(v1), proj(v2)]
      faces.push({ pts, depth: (pts[0][2] + pts[1][2] + pts[2][2]) / 3, color })
    }
  }
  faces.sort((p, q) => q.depth - p.depth)
  for (const f of faces) {
    const shade = 0.45 + 0.55 * Math.max(0, -f.depth)
    g.globalAlpha = 0.25 + shade * 0.6
    g.fillStyle = f.color
    g.beginPath()
    g.moveTo(f.pts[0][0], f.pts[0][1])
    g.lineTo(f.pts[1][0], f.pts[1][1])
    g.lineTo(f.pts[2][0], f.pts[2][1])
    g.closePath()
    g.fill()
    g.globalAlpha = 0.5
    g.strokeStyle = '#ffffff'
    g.lineWidth = Math.max(1, m / 500)
    g.stroke()
  }
  g.globalAlpha = 1

  const rollY = portrait ? h * 0.62 : h * 0.68
  const rollH = portrait ? h * 0.22 : h * 0.22
  const nowX = roll(0, rollY, w, rollH, scene, stepF, (_lane, x, y, bw, bh, lit, color) => {
    g.fillStyle = color
    g.globalAlpha = lit ? 1 : 0.55
    g.shadowColor = color
    g.shadowBlur = lit ? m / 40 : 0
    g.fillRect(x, y, bw, bh)
  })
  g.shadowBlur = 0
  g.globalAlpha = 0.6
  g.fillStyle = '#ffffff'
  g.fillRect(nowX, rollY, Math.max(1, m / 500), rollH)
  g.globalAlpha = 1

  const titleSize = m * (portrait ? 0.075 : 0.065)
  g.font = `700 ${titleSize}px "Exo 2", sans-serif`
  g.textBaseline = 'top'
  g.fillStyle = '#ffffff'
  wrapText(g, scene.song.title, pad, pad, w - pad * 2, titleSize * 1.15, 2)
  g.font = `500 ${titleSize * 0.42}px "Exo 2", sans-serif`
  g.fillStyle = '#a990ff'
  g.fillText(`${info.section} · ${info.chord}`, pad, pad + titleSize * 2.5)
  g.fillStyle = 'rgba(255,255,255,0.55)'
  g.textBaseline = 'bottom'
  g.fillText('Loop Maker', pad, h - pad * 0.7)
}

function wrapText(g: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines: number) {
  const words = text.split(/\s+/)
  let line = ''
  let lines = 0
  for (const word of words) {
    const test = line ? line + ' ' + word : word
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y + lines * lineH)
      lines++
      line = word
      if (lines >= maxLines) return
    } else line = test
  }
  if (line && lines < maxLines) g.fillText(line, x, y + lines * lineH)
}

import type { DrumHit, NoteEvent } from '../music/types'

export type Ctx = BaseAudioContext

export interface Rig {
  /** Schedules one event at time `t`; `stepSec` converts its length in steps to seconds. */
  play(ev: NoteEvent, t: number, stepSec: number): void
  output: AudioNode
}

export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

/** Per-context cache, so waveforms and noise are built once per AudioContext. */
export function cached<T>(store: WeakMap<Ctx, T>, ctx: Ctx, make: () => T): T {
  let v = store.get(ctx)
  if (!v) {
    v = make()
    store.set(ctx, v)
  }
  return v
}

export type NoiseKind = 'white' | 'mid' | 'low' | 'metal'
const noiseStore = new WeakMap<Ctx, Record<NoiseKind, AudioBuffer>>()

/**
 * Noise from a 15-bit linear-feedback shift register, the same circuit the
 * 8-bit consoles used. Clocking it slower gives grittier noise; the short
 * feedback tap gives the metallic "tonal" noise used for hats.
 */
export function noise(ctx: Ctx, kind: NoiseKind): AudioBuffer {
  return cached(noiseStore, ctx, () => {
    const make = (rate: number, shortMode: boolean) => {
      const len = ctx.sampleRate
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const data = buf.getChannelData(0)
      let reg = 1
      let acc = 0
      const inc = rate / ctx.sampleRate
      for (let i = 0; i < len; i++) {
        acc += inc
        while (acc >= 1) {
          acc -= 1
          const fb = (reg & 1) ^ ((reg >> (shortMode ? 6 : 1)) & 1)
          reg = (reg >> 1) | (fb << 14)
        }
        data[i] = reg & 1 ? 1 : -1
      }
      return buf
    }
    return {
      white: make(400000, false),
      mid: make(28000, false),
      low: make(7000, false),
      metal: make(22000, true),
    }
  })[kind]
}

export function playNoise(ctx: Ctx, kind: NoiseKind, t: number, dur: number, dest: AudioNode): AudioBufferSourceNode {
  const src = ctx.createBufferSource()
  src.buffer = noise(ctx, kind)
  src.loop = true
  src.connect(dest)
  // Random offset so repeated hits don't sound identical.
  src.start(t, Math.random() * 0.5)
  src.stop(t + dur + 0.02)
  return src
}

/** Frees a voice's helper nodes once its source has finished playing. */
export function disposeAfter(src: AudioScheduledSourceNode, ...nodes: AudioNode[]) {
  src.onended = () => {
    src.disconnect()
    for (const n of nodes) n.disconnect()
  }
}

export function gainNode(ctx: Ctx, value: number, dest?: AudioNode): GainNode {
  const g = ctx.createGain()
  g.gain.value = value
  if (dest) g.connect(dest)
  return g
}

export function biquad(ctx: Ctx, type: BiquadFilterType, freq: number, q = 0.7, dest?: AudioNode): BiquadFilterNode {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  if (dest) f.connect(dest)
  return f
}

export const FRAME = 1 / 60

/**
 * Steps a parameter the way 8-bit sound drivers did: once per video frame,
 * quantized to 16 volume levels.
 */
export function frameEnvelope(param: AudioParam, t: number, dur: number, peak: number, levels: number[], release = 2) {
  const q = (v: number) => (Math.round(v * 15) / 15) * peak
  const frames = Math.max(1, Math.round(dur / FRAME))
  for (let f = 0; f < frames; f++) {
    param.setValueAtTime(q(levels[Math.min(f, levels.length - 1)]), t + f * FRAME)
  }
  const last = levels[Math.min(frames - 1, levels.length - 1)]
  for (let r = 1; r <= release; r++) param.setValueAtTime(q(last * (1 - r / (release + 1))), t + (frames + r - 1) * FRAME)
  param.setValueAtTime(0, t + (frames + release - 1) * FRAME + 0.001)
}

export type { DrumHit }

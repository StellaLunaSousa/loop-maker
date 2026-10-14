import type { NoteEvent } from '../music/types'
import { biquad, cached, disposeAfter, gainNode, midiToHz, playNoise, type Ctx, type Rig } from './common'

/**
 * "Disco 32-bit": the CD-era sound. Those consoles played short samples
 * through a sound chip with a muffled interpolation filter and a big hardware
 * reverb. We synthesize our own original timbres (FM piano, string pad, slap
 * bass, synth lead, a breakbeat kit) and run them through the same kind of
 * filter and reverb.
 */

const irStore = new WeakMap<Ctx, AudioBuffer>()

/** A hall-like impulse response: a few early echoes and a dark, diffuse tail. */
function reverbImpulse(ctx: Ctx): AudioBuffer {
  return cached(irStore, ctx, () => {
    const len = Math.floor(ctx.sampleRate * 1.8)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch)
      let lp = 0
      for (let i = 0; i < len; i++) {
        const t = i / ctx.sampleRate
        const n = Math.random() * 2 - 1
        // One-pole low-pass that closes over time, so the tail gets darker.
        const k = 0.5 - 0.4 * Math.min(1, t / 2)
        lp += k * (n - lp)
        data[i] = lp * Math.exp(-t / 0.55) * (t < 0.012 ? t / 0.012 : 1)
      }
      for (const [ms, amp] of [[23, 0.5], [41, 0.35], [67, 0.28], [97, 0.2]]) {
        const at = Math.floor((ms + ch * 7) * ctx.sampleRate / 1000)
        data[at] += amp
      }
    }
    return buf
  })
}

export function createPsxRig(ctx: Ctx, dest: AudioNode): Rig {
  const out = gainNode(ctx, 0.75)
  // The sound chip's interpolation rolls off the top end.
  const spu = biquad(ctx, 'lowpass', 10500, 0.5)
  out.connect(spu).connect(dest)

  const verb = ctx.createConvolver()
  verb.buffer = reverbImpulse(ctx)
  const wet = gainNode(ctx, 0.5)
  verb.connect(wet).connect(spu)

  const lane = (level: number, send: number) => {
    const g = gainNode(ctx, level, out)
    g.connect(gainNode(ctx, send, verb))
    return g
  }
  const lanes = {
    drums: lane(0.85, 0.12),
    bass: lane(0.8, 0.04),
    bassTone: null as unknown as BiquadFilterNode,
    chords: lane(0.38, 0.45),
    melody: lane(0.36, 0.35),
  }

  lanes.bassTone = biquad(ctx, 'lowpass', 1400, 0.8, lanes.bass)

  /** Two-operator FM voice: modulator → carrier frequency, with a decaying index. */
  function fm(freq: number, t: number, dur: number, opts: { ratio: number; index: number; indexEnd: number; indexTime: number; amp: number; decay: number; release: number }, dest: AudioNode) {
    const car = ctx.createOscillator()
    car.frequency.value = freq
    const mod = ctx.createOscillator()
    mod.frequency.value = freq * opts.ratio
    const modGain = gainNode(ctx, 0)
    modGain.gain.setValueAtTime(freq * opts.index, t)
    modGain.gain.exponentialRampToValueAtTime(Math.max(0.01, freq * opts.indexEnd), t + opts.indexTime)
    mod.connect(modGain).connect(car.frequency)
    const amp = gainNode(ctx, 0, dest)
    amp.gain.setValueAtTime(0, t)
    amp.gain.linearRampToValueAtTime(opts.amp, t + 0.004)
    amp.gain.setTargetAtTime(opts.amp * 0.25, t + 0.004, opts.decay)
    amp.gain.setTargetAtTime(0, t + dur, opts.release)
    car.connect(amp)
    const end = t + dur + opts.release * 5
    car.start(t)
    mod.start(t)
    car.stop(end)
    mod.stop(end)
    disposeAfter(car, mod, modGain, amp)
  }

  function pad(freq: number, t: number, dur: number, v: number, dest: AudioNode) {
    const f = biquad(ctx, 'lowpass', 1600, 0.6, dest)
    const amp = gainNode(ctx, 0, f)
    amp.gain.setValueAtTime(0, t)
    amp.gain.linearRampToValueAtTime(v * 0.22, t + 0.25)
    amp.gain.setTargetAtTime(0, t + dur, 0.25)
    let last: OscillatorNode | null = null
    for (const det of [-9, 0, 8]) {
      const o = (last = ctx.createOscillator())
      o.type = 'sawtooth'
      o.frequency.value = freq
      o.detune.value = det
      o.connect(amp)
      o.start(t)
      o.stop(t + dur + 1.4)
    }
    if (last) disposeAfter(last, amp, f)
  }

  function lead(freq: number, t: number, dur: number, v: number, dest: AudioNode) {
    const f = biquad(ctx, 'lowpass', 3200, 1.5, dest)
    f.frequency.setValueAtTime(4200, t)
    f.frequency.setTargetAtTime(2000, t, 0.15)
    const amp = gainNode(ctx, 0, f)
    amp.gain.setValueAtTime(0, t)
    amp.gain.linearRampToValueAtTime(v * 0.5, t + 0.012)
    amp.gain.setTargetAtTime(v * 0.36, t + 0.012, 0.12)
    amp.gain.setTargetAtTime(0, t + dur * 0.95, 0.06)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 5.2
    const depth = gainNode(ctx, 0)
    depth.gain.setValueAtTime(0, t)
    depth.gain.linearRampToValueAtTime(dur > 0.35 ? 14 : 0, t + Math.min(0.4, dur))
    lfo.connect(depth)
    const end = t + dur + 0.5
    const parts: AudioNode[] = [f, amp, depth]
    for (const [type, det, level] of [['sawtooth', -5, 0.6], ['triangle', 6, 0.8]] as const) {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = freq
      o.detune.value = det
      depth.connect(o.detune)
      const g = gainNode(ctx, level, amp)
      parts.push(o, g)
      o.connect(g)
      o.start(t)
      o.stop(end)
    }
    lfo.start(t)
    lfo.stop(end)
    disposeAfter(lfo, ...parts)
  }

  function sine(start: number, end: number, t: number, dur: number, v: number, dest: AudioNode) {
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(start, t)
    o.frequency.exponentialRampToValueAtTime(end, t + dur * 0.6)
    const g = gainNode(ctx, 0, dest)
    g.gain.setValueAtTime(v, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.connect(g)
    o.start(t)
    o.stop(t + dur + 0.01)
    disposeAfter(o, g)
  }

  function noiseBurst(kind: 'white' | 'mid', filter: BiquadFilterType, freq: number, t: number, dur: number, v: number, dest: AudioNode) {
    const f = biquad(ctx, filter, freq, filter === 'bandpass' ? 0.8 : 0.7, dest)
    const g = gainNode(ctx, 0, f)
    g.gain.setValueAtTime(v, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    disposeAfter(playNoise(ctx, kind, t, dur, g), g, f)
  }

  function play(ev: NoteEvent, t: number, stepSec: number) {
    const dur = ev.len * stepSec
    const v = ev.vel

    if (ev.lane === 'drums') {
      const d = lanes.drums
      switch (ev.drum) {
        case 'kick':
          sine(150, 42, t, 0.38, 1 * v, d)
          noiseBurst('white', 'lowpass', 3000, t, 0.012, 0.4 * v, d)
          break
        case 'snare':
          sine(200, 160, t, 0.11, 0.5 * v, d)
          noiseBurst('white', 'bandpass', 2200, t, 0.2, 0.9 * v, d)
          break
        case 'hat':
          noiseBurst('white', 'highpass', 8000, t, 0.045, 0.32 * v, d)
          break
        case 'openhat':
          noiseBurst('white', 'highpass', 7500, t, 0.24, 0.28 * v, d)
          break
        case 'tomHi':
          sine(240, 170, t, 0.25, 0.75 * v, d)
          break
        case 'tomMid':
          sine(180, 120, t, 0.28, 0.75 * v, d)
          break
        case 'tomLo':
          sine(130, 85, t, 0.32, 0.8 * v, d)
          break
        case 'crash':
          noiseBurst('white', 'highpass', 5000, t, 1.6, 0.35 * v, d)
          break
      }
      return
    }

    const freqs = ev.notes.map(midiToHz)

    if (ev.lane === 'bass') {
      const f = lanes.bassTone
      for (const hz of freqs) {
        fm(hz, t, dur * 0.9, { ratio: 1, index: 2.2, indexEnd: 0.4, indexTime: 0.12, amp: 0.85 * v, decay: 0.35, release: 0.04 }, f)
        sine(hz, hz, t, Math.max(0.12, dur * 0.95), 0.4 * v, f)
      }
      return
    }

    if (ev.lane === 'chords') {
      for (const hz of freqs) {
        if (ev.sustain) pad(hz, t, dur, v, lanes.chords)
        else fm(hz, t, dur, { ratio: 1, index: 1.6, indexEnd: 0.15, indexTime: 0.5, amp: 0.4 * v, decay: 0.45, release: 0.12 }, lanes.chords)
      }
      return
    }

    for (const hz of freqs) lead(hz, t, dur, v, lanes.melody)
  }

  return { play, output: out }
}

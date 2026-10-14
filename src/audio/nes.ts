import type { NoteEvent } from '../music/types'
import { FRAME, biquad, cached, disposeAfter, frameEnvelope, gainNode, midiToHz, playNoise, type Ctx, type Rig } from './common'

/**
 * "Cartucho 8-bit": two pulse waves, a stepped triangle and LFSR noise,
 * driven frame by frame like an 8-bit sound driver. Every sound here is
 * synthesized; nothing is sampled.
 */

const waveStore = new WeakMap<Ctx, { pulse12: PeriodicWave; pulse25: PeriodicWave; pulse50: PeriodicWave; tri: PeriodicWave }>()

function pulseWave(ctx: Ctx, duty: number): PeriodicWave {
  const n = 96
  const re = new Float32Array(n)
  const im = new Float32Array(n)
  for (let k = 1; k < n; k++) {
    re[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI)
    im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI)
  }
  return ctx.createPeriodicWave(re, im)
}

/** The 4-bit, 32-step triangle that gives 8-bit bass its slightly buzzy edge. */
function steppedTriangle(ctx: Ctx): PeriodicWave {
  const steps = [...Array(16).keys()].reverse().concat([...Array(16).keys()])
  const n = 64
  const re = new Float32Array(n)
  const im = new Float32Array(n)
  for (let k = 1; k < n; k++) {
    for (let i = 0; i < 32; i++) {
      const v = steps[i] / 7.5 - 1
      // Integrate each flat step exactly so the stair shape survives.
      const a = (2 * Math.PI * k * i) / 32
      const b = (2 * Math.PI * k * (i + 1)) / 32
      re[k] += (v * (Math.sin(b) - Math.sin(a))) / (Math.PI * k)
      im[k] += (v * (Math.cos(a) - Math.cos(b))) / (Math.PI * k)
    }
  }
  return ctx.createPeriodicWave(re, im)
}

function waves(ctx: Ctx) {
  return cached(waveStore, ctx, () => ({
    pulse12: pulseWave(ctx, 0.125),
    pulse25: pulseWave(ctx, 0.25),
    pulse50: pulseWave(ctx, 0.5),
    tri: steppedTriangle(ctx),
  }))
}

export function createNesRig(ctx: Ctx, dest: AudioNode): Rig {
  // The console's own output filters: a high-pass around 90 Hz and a gentle low-pass.
  const out = gainNode(ctx, 0.55)
  const hp = biquad(ctx, 'highpass', 90, 0.7)
  const lp = biquad(ctx, 'lowpass', 12000, 0.7)
  out.connect(hp).connect(lp).connect(dest)
  const w = waves(ctx)

  const lanes = {
    drums: gainNode(ctx, 0.9, out),
    bass: gainNode(ctx, 0.95, out),
    chords: gainNode(ctx, 0.32, out),
    melody: gainNode(ctx, 0.42, out),
  }

  function tone(wave: PeriodicWave, freqs: number[], t: number, dur: number, dest: AudioNode, opts: { vibrato?: boolean; arpFrames?: number } = {}) {
    const osc = ctx.createOscillator()
    osc.setPeriodicWave(wave)
    if (freqs.length > 1) {
      // One channel can only play one note: cycle through the chord fast,
      // the classic chiptune way of faking harmony.
      const every = (opts.arpFrames ?? 2) * FRAME
      let i = 0
      for (let x = t; x < t + dur + 3 * FRAME; x += every) osc.frequency.setValueAtTime(freqs[i++ % freqs.length], x)
    } else {
      osc.frequency.setValueAtTime(freqs[0], t)
      if (opts.vibrato && dur > 0.3) {
        for (let x = t + 0.18; x < t + dur; x += FRAME) {
          osc.detune.setValueAtTime(18 * Math.sin(2 * Math.PI * 5.5 * (x - t - 0.18)), x)
        }
      }
    }
    osc.connect(dest)
    osc.start(t)
    osc.stop(t + dur + 4 * FRAME)
    disposeAfter(osc, dest)
  }

  function sweep(start: number, end: number, t: number, dur: number, vel: number, dest: AudioNode) {
    const osc = ctx.createOscillator()
    osc.setPeriodicWave(w.tri)
    osc.frequency.setValueAtTime(start, t)
    osc.frequency.exponentialRampToValueAtTime(end, t + dur)
    const g = gainNode(ctx, vel, dest)
    g.gain.setValueAtTime(vel, t)
    g.gain.setValueAtTime(0, t + dur)
    osc.connect(g)
    osc.start(t)
    osc.stop(t + dur + 0.01)
    disposeAfter(osc, g)
  }

  function noiseHit(kind: Parameters<typeof playNoise>[1], t: number, dur: number, peak: number, dest: AudioNode, curve: number[]) {
    const g = gainNode(ctx, 0, dest)
    frameEnvelope(g.gain, t, dur, peak, curve, 1)
    disposeAfter(playNoise(ctx, kind, t, dur + 2 * FRAME, g), g)
  }

  const decay = (frames: number) => Array.from({ length: frames }, (_, i) => 1 - i / frames)

  function play(ev: NoteEvent, t: number, stepSec: number) {
    const dur = ev.len * stepSec
    const v = ev.vel

    if (ev.lane === 'drums') {
      const d = lanes.drums
      switch (ev.drum) {
        case 'kick':
          sweep(240, 50, t, 0.09, 0.9 * v, d)
          noiseHit('low', t, 0.03, 0.35 * v, d, decay(2))
          break
        case 'snare':
          sweep(220, 140, t, 0.05, 0.5 * v, d)
          noiseHit('mid', t, 0.16, 0.5 * v, d, decay(10))
          break
        case 'hat':
          noiseHit('metal', t, 0.035, 0.22 * v, d, decay(2))
          break
        case 'openhat':
          noiseHit('white', t, 0.16, 0.2 * v, d, decay(10))
          break
        case 'tomHi':
          sweep(330, 180, t, 0.13, 0.75 * v, d)
          break
        case 'tomMid':
          sweep(240, 130, t, 0.15, 0.75 * v, d)
          break
        case 'tomLo':
          sweep(170, 85, t, 0.18, 0.8 * v, d)
          break
        case 'crash':
          noiseHit('white', t, 0.9, 0.3 * v, d, decay(54))
          break
      }
      return
    }

    const freqs = ev.notes.map(midiToHz)

    if (ev.lane === 'bass') {
      // The triangle channel has no volume control: it is on or off.
      const g = gainNode(ctx, 0, lanes.bass)
      const gate = Math.max(FRAME * 2, dur - stepSec * 0.15)
      g.gain.setValueAtTime(v, t)
      g.gain.setValueAtTime(0, t + gate)
      tone(w.tri, freqs, t, gate, g)
      return
    }

    if (ev.lane === 'chords') {
      const g = gainNode(ctx, 0, lanes.chords)
      const curve = ev.sustain ? [0.6, 0.8, 1, 1, 0.9, 0.85, 0.8] : [1, 0.9, 0.8, 0.7, 0.6, 0.55, 0.5]
      frameEnvelope(g.gain, t, dur * 0.92, v, curve, 3)
      tone(ev.sustain ? w.pulse50 : w.pulse12, freqs, t, dur, g, { arpFrames: ev.sustain ? 3 : 1 })
      return
    }

    // Melody: the lead pulse with a little attack bump and delayed vibrato.
    const g = gainNode(ctx, 0, lanes.melody)
    frameEnvelope(g.gain, t, dur * 0.94, v, [1, 0.93, 0.87, 0.8, 0.73, 0.7, 0.67], 3)
    tone(w.pulse25, freqs, t, dur, g, { vibrato: true })
  }

  return { play, output: out }
}

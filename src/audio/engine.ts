import { compile, stepSeconds, type Compiled } from '../music/compose'
import { STEPS_PER_SECTION, type ConsoleId, type Song } from '../music/types'
import { gainNode, type Ctx, type Rig } from './common'
import { createNesRig } from './nes'
import { createPsxRig } from './psx'

/** Master chain shared by live playback and export, so both sound the same. */
function createChain(ctx: Ctx, consoleId: ConsoleId): { rig: Rig; output: GainNode } {
  const output = gainNode(ctx, 0.8)
  // A gentle bus compressor to glue the lanes, then a fast limiter so nothing clips.
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -18
  comp.ratio.value = 3
  comp.attack.value = 0.006
  comp.release.value = 0.2
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -4
  limiter.knee.value = 0
  limiter.ratio.value = 20
  limiter.attack.value = 0.001
  limiter.release.value = 0.08
  const trim = gainNode(ctx, 0.7)
  trim.connect(comp).connect(limiter).connect(output)
  const rig = consoleId === 'nes' ? createNesRig(ctx, trim) : createPsxRig(ctx, trim)
  return { rig, output }
}

/** Seconds of silence after the last note, so reverb and the final chord ring out. */
export const TAIL_SECONDS = 2.5
const LEAD_IN = 0.05

export function songDuration(song: Song): number {
  return LEAD_IN + song.order.length * STEPS_PER_SECTION * stepSeconds(song) + TAIL_SECONDS
}

/**
 * Renders the whole song faster than real time, for downloads and video.
 *
 * Notes are scheduled one window at a time: the render pauses at each window
 * edge, finished voices free their nodes, and the next window is queued. Queuing
 * everything up front keeps thousands of idle nodes alive and is many times slower.
 */
export async function renderSong(song: Song, sampleRate = 48000): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(songDuration(song) * sampleRate), sampleRate)
  const { rig, output } = createChain(ctx, song.console)
  output.connect(ctx.destination)
  const stepSec = stepSeconds(song)
  const events = compile(song).events
  let next = 0
  const scheduleUntil = (time: number) => {
    while (next < events.length && LEAD_IN + events[next].step * stepSec < time) {
      const ev = events[next++]
      rig.play(ev, LEAD_IN + ev.step * stepSec, stepSec)
    }
  }
  const WINDOW = 1
  scheduleUntil(WINDOW + 0.5)
  for (let t = WINDOW; t < ctx.length / sampleRate - 0.1; t += WINDOW) {
    const at = t
    ctx.suspend(at).then(async () => {
      await new Promise((r) => setTimeout(r, 0))
      scheduleUntil(at + WINDOW + 0.5)
      await ctx.resume()
    })
  }
  return ctx.startRendering()
}

export interface PlayPosition {
  step: number
  /** 0–1 progress inside the current step, for smooth animation. */
  frac: number
}

/**
 * Real-time playback with a look-ahead scheduler: a timer queues notes a
 * little ahead on the audio clock, which keeps timing tight even when the UI
 * is busy. Edits take effect on the next scheduled step.
 */
export class Player {
  private ctx: AudioContext | null = null
  private chain: { rig: Rig; output: GainNode } | null = null
  private chainConsole: ConsoleId | null = null
  private song: Song | null = null
  private compiled: Compiled | null = null
  private timer: number | null = null
  private nextStep = 0
  private nextTime = 0
  private range: [number, number] = [0, 0]
  private loopingSection = false
  private history: { step: number; time: number; dur: number }[] = []

  get playing() {
    return this.timer !== null
  }

  setSong(song: Song) {
    this.song = song
    this.compiled = compile(song)
    if (this.playing && this.chainConsole !== song.console) this.rebuildChain()
    const total = this.compiled.totalSteps
    if (!this.loopingSection || this.range[1] > total) {
      this.range = [0, total]
      this.loopingSection = false
    }
    if (this.nextStep >= this.range[1]) this.nextStep = this.range[0]
  }

  /** Plays from a section. With `loopSection`, repeats only that section. */
  async play(fromSection = 0, loopSection = false) {
    if (!this.song || !this.compiled) return
    if (!this.ctx) this.ctx = new AudioContext({ latencyHint: 'interactive' })
    if (this.ctx.state !== 'running') await this.ctx.resume()
    this.stopTimer()
    this.rebuildChain()
    const start = fromSection * STEPS_PER_SECTION
    this.loopingSection = loopSection
    this.range = loopSection ? [start, start + STEPS_PER_SECTION] : [0, this.compiled.totalSteps]
    this.nextStep = start
    this.nextTime = this.ctx.currentTime + 0.06
    this.history = []
    this.tick()
    this.timer = window.setInterval(() => this.tick(), 25)
  }

  stop() {
    this.stopTimer()
    if (this.chain && this.ctx) {
      // Fade out what is already queued instead of cutting it with a click.
      const out = this.chain.output
      out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02)
      setTimeout(() => out.disconnect(), 200)
    }
    this.chain = null
    this.history = []
  }

  position(): PlayPosition | null {
    if (!this.ctx || !this.playing) return null
    const now = this.ctx.currentTime - (this.ctx.outputLatency || 0)
    let cur = null
    for (const h of this.history) {
      if (h.time <= now) cur = h
      else break
    }
    if (!cur) return null
    return { step: cur.step, frac: Math.min(1, (now - cur.time) / cur.dur) }
  }

  private stopTimer() {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
  }

  private rebuildChain() {
    if (!this.ctx || !this.song) return
    if (this.chain) {
      const old = this.chain.output
      old.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02)
      setTimeout(() => old.disconnect(), 200)
    }
    this.chain = createChain(this.ctx, this.song.console)
    this.chain.output.connect(this.ctx.destination)
    this.chainConsole = this.song.console
  }

  private tick() {
    if (!this.ctx || !this.song || !this.compiled || !this.chain) return
    const horizon = this.ctx.currentTime + 0.12
    while (this.nextTime < horizon) {
      const stepSec = stepSeconds(this.song)
      for (const ev of this.compiled.byStep[this.nextStep] ?? []) this.chain.rig.play(ev, this.nextTime, stepSec)
      this.history.push({ step: this.nextStep, time: this.nextTime, dur: stepSec })
      if (this.history.length > 64) this.history.shift()
      this.nextTime += stepSec
      this.nextStep++
      if (this.nextStep >= this.range[1]) this.nextStep = this.range[0]
    }
  }
}

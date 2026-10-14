import { BLOCK_BY_ID, drumHits, type PitchedBlock } from './blocks'
import { PROGRESSIONS, degreeToMidi, voiceLead, type Chord } from './theory'
import {
  BARS_PER_SECTION, STEPS_PER_BAR, STEPS_PER_SECTION,
  type ConsoleId, type DrumHit, type LaneId, type NoteEvent, type SectionType, type Song, type Speed,
} from './types'

const BPM: Record<ConsoleId, Record<Speed, number>> = {
  nes: { lento: 110, normal: 140, rapido: 168 },
  psx: { lento: 92, normal: 120, rapido: 150 },
}

export function bpmOf(song: Pick<Song, 'console' | 'speed'>): number {
  return BPM[song.console][song.speed]
}

export function stepSeconds(song: Pick<Song, 'console' | 'speed'>): number {
  return 60 / bpmOf(song) / 4
}

/** Register of each pitched lane, as [tonic MIDI note before key, lowest and highest chord root degree]. */
const REGISTER: Record<Exclude<LaneId, 'drums'>, { base: number; lo: number; hi: number }> = {
  bass: { base: 36, lo: 0, hi: 6 },
  chords: { base: 60, lo: -3, hi: 3 },
  melody: { base: 72, lo: -3, hi: 3 },
}

/** Chord tone index to scale-degree offset: root, third, fifth, octave. */
const TONE_DEGREE = [0, 2, 4, 7]

const VELOCITY: Record<LaneId, number> = { drums: 0.8, bass: 0.85, chords: 0.6, melody: 0.9 }

/** Keeps every key within a tritone of C so no key ends up shrill or muddy. */
const centered = (key: number) => ((key + 6) % 12) - 6

export function sectionChords(song: Pick<Song, 'vibe'>, type: SectionType): Chord[] {
  return PROGRESSIONS[song.vibe][type]
}

export interface Compiled {
  events: NoteEvent[]
  totalSteps: number
  /** Events grouped by the step they start on, for the real-time scheduler. */
  byStep: NoteEvent[][]
}

export function compile(song: Song): Compiled {
  const events: NoteEvent[] = []
  const muted = new Set(song.muted)

  song.order.forEach((type, col) => {
    const start = col * STEPS_PER_SECTION
    const parts = song.parts[type]
    const chords = sectionChords(song, type)
    const prevType = col > 0 ? song.order[col - 1] : null
    const nextType = col < song.order.length - 1 ? song.order[col + 1] : null
    const isEnding = type === 'final' && nextType === null

    for (const lane of ['drums', 'bass', 'chords', 'melody'] as const) {
      const blockId = parts[lane]
      if (!blockId || muted.has(lane)) continue
      const block = BLOCK_BY_ID[blockId]
      if (!block) continue

      if (block.lane === 'drums') {
        const fill = nextType !== null && nextType !== type
        const crash = prevType !== null && prevType !== type
        for (let bar = 0; bar < BARS_PER_SECTION; bar++) {
          const barStart = start + bar * STEPS_PER_BAR
          if (isEnding && bar === BARS_PER_SECTION - 1) {
            events.push(drum(barStart, 'kick', 1), drum(barStart, 'crash', 1))
            continue
          }
          const isFillBar = fill && bar === BARS_PER_SECTION - 1
          for (const h of drumHits(block.bars[bar % block.bars.length])) {
            if (isFillBar && h.step >= 8) continue
            const vel = h.hit === 'hat' ? (h.accent ? 0.7 : 0.45) : h.accent ? 1 : 0.8
            events.push(drum(barStart + h.step, h.hit, vel))
          }
          if (isFillBar) {
            const run: [number, DrumHit][] = [[8, 'snare'], [10, 'tomHi'], [11, 'tomHi'], [12, 'tomMid'], [13, 'tomMid'], [14, 'tomLo'], [15, 'snare']]
            for (const [s, hit] of run) events.push(drum(barStart + s, hit, 0.85))
          }
          if (crash && bar === 0) events.push(drum(barStart, 'crash', 0.9))
        }
        continue
      }

      events.push(...pitched(song, block, block.lane, chords, start, isEnding))
    }
  })

  events.sort((a, b) => a.step - b.step)
  const totalSteps = song.order.length * STEPS_PER_SECTION
  const byStep: NoteEvent[][] = Array.from({ length: totalSteps }, () => [])
  for (const e of events) byStep[e.step]?.push(e)
  return { events, totalSteps, byStep }
}

function drum(step: number, hit: DrumHit, vel: number): NoteEvent {
  return { step, len: 1, lane: 'drums', notes: [], drum: hit, vel }
}

function pitched(
  song: Song, block: PitchedBlock, lane: Exclude<LaneId, 'drums'>, chords: Chord[], start: number, isEnding: boolean,
): NoteEvent[] {
  const reg = REGISTER[lane]
  const tonic = reg.base + centered(song.key)
  const roots = voiceLead(chords, reg.lo, reg.hi)
  const out: NoteEvent[] = []

  for (let bar = 0; bar < BARS_PER_SECTION; bar++) {
    const barStart = start + bar * STEPS_PER_BAR
    const chord = chords[bar]
    const pitch = (tone: number, scaleStep = 0, octave = 0) =>
      degreeToMidi(roots[bar] + TONE_DEGREE[tone] + scaleStep + octave * 7, song.vibe, 0, tonic, chord)

    if (isEnding && bar === BARS_PER_SECTION - 1) {
      // The last bar of the song resolves on one long tonic chord.
      const tones = lane === 'chords' ? [0, 1, 2] : [0]
      out.push({ step: barStart, len: STEPS_PER_BAR, lane, notes: tones.map((t) => pitch(t)), vel: VELOCITY[lane], sustain: true })
      continue
    }

    // Group notes that start together into one chord event.
    const groups = new Map<number, { len: number; notes: number[] }>()
    for (const [step, len, tone, scaleStep, octave] of block.bars[bar % block.bars.length]) {
      const g = groups.get(step) ?? { len, notes: [] }
      g.notes.push(pitch(tone, scaleStep, octave))
      g.len = Math.max(g.len, len)
      groups.set(step, g)
    }
    for (const [step, g] of groups) {
      out.push({ step: barStart + step, len: g.len, lane, notes: g.notes.sort((a, b) => a - b), vel: VELOCITY[lane], sustain: block.sustain })
    }
  }
  return out
}

import type { SectionType, Vibe } from './types'

/** Semitones of each scale degree above the tonic. */
const MODES: Record<Vibe, number[]> = {
  alegre: [0, 2, 4, 5, 7, 9, 11], // maior (jônio)
  aventura: [0, 2, 3, 5, 7, 9, 10], // dórico
  melancolico: [0, 2, 3, 5, 7, 8, 10], // menor natural (eólio)
}

/**
 * A chord is a scale degree (0 = I) with a triad stacked in thirds from the
 * current mode. `raise` lists scale degrees lifted a semitone while the chord
 * plays, e.g. the leading tone of a harmonic-minor V. Every lane respects it,
 * so the melody never clashes with a raised chord.
 */
export interface Chord {
  deg: number
  raise?: number[]
}

const c = (deg: number, raise?: number[]): Chord => ({ deg, raise })
const V_HARM = c(4, [6])

/**
 * One chord per bar, four bars per section. Each progression is written so it
 * flows into the sections that usually follow it (a bridge ends on a
 * dominant, the ending lands on the tonic).
 */
export const PROGRESSIONS: Record<Vibe, Record<SectionType, Chord[]>> = {
  alegre: {
    intro: [c(0), c(3), c(0), c(4)],
    verso: [c(0), c(5), c(3), c(4)],
    refrao: [c(3), c(4), c(0), c(5)],
    ponte: [c(5), c(2), c(3), c(4)],
    final: [c(3), c(4), c(0), c(0)],
  },
  aventura: {
    intro: [c(0), c(3), c(0), c(3)],
    verso: [c(0), c(3), c(0), c(6)],
    refrao: [c(2), c(6), c(3), c(0)],
    ponte: [c(6), c(3), c(4, [6]), c(4, [6])],
    final: [c(6), c(3), c(0), c(0)],
  },
  melancolico: {
    intro: [c(0), c(5), c(0), c(6)],
    verso: [c(0), c(5), c(2), c(6)],
    refrao: [c(5), c(6), c(2), c(0)],
    ponte: [c(3), c(5), V_HARM, V_HARM],
    final: [c(3), V_HARM, c(0), c(0)],
  },
}

/** Pitch (MIDI) of a scale degree. Degrees past 6 continue into higher octaves. */
export function degreeToMidi(degree: number, vibe: Vibe, key: number, base: number, chord?: Chord): number {
  const mode = MODES[vibe]
  const oct = Math.floor(degree / 7)
  const idx = ((degree % 7) + 7) % 7
  const raised = chord?.raise?.includes(idx) ? 1 : 0
  return base + key + oct * 12 + mode[idx] + raised
}

/** The pitch classes a chord contains, for tests and chord labels. */
export function chordPitchClasses(chord: Chord, vibe: Vibe, key: number): number[] {
  return [0, 2, 4].map((t) => degreeToMidi(chord.deg + t, vibe, key, 0, chord) % 12)
}

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

export function noteName(pc: number): string {
  return NOTE_NAMES[((pc % 12) + 12) % 12]
}

export function chordLabel(chord: Chord, vibe: Vibe, key: number): string {
  const [r, t, f] = chordPitchClasses(chord, vibe, key)
  const third = (t - r + 12) % 12
  const fifth = (f - r + 12) % 12
  const suffix = fifth === 6 ? 'dim' : third === 3 ? 'm' : ''
  return noteName(r) + suffix
}

export function keyLabel(vibe: Vibe, key: number): string {
  return noteName(key) + (vibe === 'alegre' ? ' maior' : vibe === 'aventura' ? ' dórico' : ' menor')
}

/**
 * Picks the octave of each chord root so consecutive chords move as little as
 * possible. This keeps melodies and arpeggios in a steady register instead of
 * jumping a sixth whenever the progression goes to vi.
 */
export function voiceLead(chords: Chord[], lo: number, hi: number): number[] {
  const out: number[] = []
  let prev = 0
  for (const ch of chords) {
    const options = [ch.deg - 7, ch.deg, ch.deg + 7].filter((d) => d >= lo && d <= hi)
    const best = options.reduce((a, b) => (Math.abs(b - prev) < Math.abs(a - prev) ? b : a))
    out.push(best)
    prev = best
  }
  return out
}

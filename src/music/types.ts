export type ConsoleId = 'nes' | 'psx'
export type Vibe = 'alegre' | 'aventura' | 'melancolico'
export type Speed = 'lento' | 'normal' | 'rapido'
export type LaneId = 'drums' | 'bass' | 'chords' | 'melody'
export type SectionType = 'intro' | 'verso' | 'refrao' | 'ponte' | 'final'

export const LANES: LaneId[] = ['drums', 'bass', 'chords', 'melody']
export const SECTION_TYPES: SectionType[] = ['intro', 'verso', 'refrao', 'ponte', 'final']

/** Which block each lane plays in a section. `null` means silence. */
export type SectionParts = Record<LaneId, string | null>

/**
 * A song is pure data. Sections of the same type always share their parts,
 * so a chorus sounds like the chorus every time it comes back.
 */
export interface Song {
  v: 1
  title: string
  console: ConsoleId
  vibe: Vibe
  speed: Speed
  /** Tonic pitch class, 0 = C. */
  key: number
  order: SectionType[]
  parts: Record<SectionType, SectionParts>
  muted: LaneId[]
}

export const STEPS_PER_BAR = 16
export const BARS_PER_SECTION = 4
export const STEPS_PER_SECTION = STEPS_PER_BAR * BARS_PER_SECTION
export const MAX_SECTIONS = 12

export type DrumHit = 'kick' | 'snare' | 'hat' | 'openhat' | 'tomHi' | 'tomMid' | 'tomLo' | 'crash'

/** One sound to play, in steps (sixteenth notes) from the song start. */
export interface NoteEvent {
  step: number
  len: number
  lane: LaneId
  /** MIDI notes. Several notes means a chord. Empty for drums. */
  notes: number[]
  drum?: DrumHit
  vel: number
  /** Pad-like chord blocks ask the instrument for a sustained sound. */
  sustain?: boolean
}

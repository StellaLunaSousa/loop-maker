import { describe, expect, it } from 'vitest'
import { blocksForLane } from './blocks'
import { compile, sectionChords } from './compose'
import { defaultSong, surpriseSong } from './presets'
import { decodeSong, encodeSong } from './share'
import { chordPitchClasses, degreeToMidi } from './theory'
import { SECTION_TYPES, STEPS_PER_BAR, STEPS_PER_SECTION, type Song, type Vibe } from './types'

const VIBES: Vibe[] = ['alegre', 'aventura', 'melancolico']

/** A song where every section uses the given blocks, one section of each type. */
function songWith(vibe: Vibe, key: number, lane: 'bass' | 'chords' | 'melody', id: string): Song {
  const s = defaultSong()
  s.vibe = vibe
  s.key = key
  s.order = [...SECTION_TYPES]
  for (const t of SECTION_TYPES) s.parts[t] = { drums: null, bass: null, chords: null, melody: null, [lane]: id }
  return s
}

describe('harmonia', () => {
  for (const vibe of VIBES) {
    for (const lane of ['bass', 'chords', 'melody'] as const) {
      for (const block of blocksForLane(lane)) {
        it(`${vibe} / ${block.name}: notas nos tempos fortes pertencem ao acorde, e todas pertencem à escala`, () => {
          for (let key = 0; key < 12; key++) {
            const song = songWith(vibe, key, lane, block.id)
            for (const ev of compile(song).events) {
              const col = Math.floor(ev.step / STEPS_PER_SECTION)
              const bar = Math.floor((ev.step % STEPS_PER_SECTION) / STEPS_PER_BAR)
              const chord = sectionChords(song, song.order[col])[bar]
              const chordPcs = chordPitchClasses(chord, vibe, key)
              const scalePcs = [0, 1, 2, 3, 4, 5, 6].map((d) => degreeToMidi(d, vibe, key, 0, chord) % 12)
              for (const n of ev.notes) {
                expect(Number.isFinite(n)).toBe(true)
                expect(scalePcs).toContain(n % 12)
                if (ev.step % 4 === 0) expect(chordPcs).toContain(n % 12)
              }
            }
          }
        })
      }
    }
  }

  it('a música termina no acorde da tônica', () => {
    for (const vibe of VIBES) {
      const song = { ...defaultSong(), vibe }
      const { events, totalSteps } = compile(song)
      const last = events.filter((e) => e.step === totalSteps - STEPS_PER_BAR && e.lane === 'bass')
      expect(last).toHaveLength(1)
      expect(last[0].notes[0] % 12).toBe(song.key % 12)
    }
  })

  it('melodias ficam numa região confortável', () => {
    for (let i = 0; i < 50; i++) {
      const song = surpriseSong(defaultSong())
      for (const ev of compile(song).events) {
        for (const n of ev.notes) {
          expect(n).toBeGreaterThanOrEqual(24)
          expect(n).toBeLessThanOrEqual(100)
        }
      }
    }
  })
})

describe('link compartilhável', () => {
  it('ida e volta preserva a música', () => {
    for (let i = 0; i < 20; i++) {
      const song = { ...surpriseSong(defaultSong()), title: 'Fase ' + i + ' ção', muted: ['bass' as const] }
      expect(decodeSong(encodeSong(song))).toEqual(song)
    }
  })
})

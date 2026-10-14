import type { ConsoleId, SectionParts, SectionType, Song, Vibe } from './types'

const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)]

export const SECTION_LABEL: Record<SectionType, string> = {
  intro: 'Intro',
  verso: 'Verso',
  refrao: 'Refrão',
  ponte: 'Ponte',
  final: 'Final',
}

const TEMPLATES: SectionType[][] = [
  ['intro', 'verso', 'refrao', 'verso', 'refrao', 'ponte', 'refrao', 'final'],
  ['intro', 'verso', 'verso', 'refrao', 'ponte', 'refrao', 'final'],
  ['intro', 'refrao', 'verso', 'refrao', 'ponte', 'refrao', 'refrao', 'final'],
]

export function defaultSong(): Song {
  return {
    v: 1,
    title: 'Minha música',
    console: 'nes',
    vibe: 'alegre',
    speed: 'normal',
    key: 0,
    order: [...TEMPLATES[0]],
    parts: {
      intro: { drums: 'd-leve', bass: 'b-longo', chords: 'c-vaivem', melody: null },
      verso: { drums: 'd-marcha', bass: 'b-fundamental', chords: 'c-alberti', melody: 'm-saltitante' },
      refrao: { drums: 'd-galope', bass: 'b-oitavas', chords: 'c-arpejo', melody: 'm-heroica' },
      ponte: { drums: 'd-meio', bass: 'b-longo', chords: 'c-tapete', melody: 'm-cantada' },
      final: { drums: 'd-galope', bass: 'b-oitavas', chords: 'c-arpejo', melody: 'm-heroica' },
    },
    muted: [],
  }
}

/**
 * Builds a whole song with a real arc: a quiet intro, a verse, a bigger
 * chorus with a different melody, a softer bridge, and an ending that reuses
 * the chorus. Randomness only chooses among options that fit each role.
 */
export function surpriseSong(base: Song, opts: { keepVibe?: boolean } = {}): Song {
  const consoleId: ConsoleId = base.console
  const vibe: Vibe = opts.keepVibe ? base.vibe : pick(['alegre', 'aventura', 'melancolico'] as Vibe[])
  const psx = consoleId === 'psx'

  const melodyVerse = pick(['m-saltitante', 'm-sincopa', 'm-eco', 'm-cantada'])
  const melodyChorus = pick(['m-heroica', 'm-corrida', 'm-saltitante', 'm-sincopa'].filter((m) => m !== melodyVerse))
  const melodyBridge = pick(['m-cantada', 'm-eco', null].filter((m) => m !== melodyVerse && m !== melodyChorus))

  const verso: SectionParts = {
    drums: pick(['d-marcha', 'd-meio', psx ? 'd-quebrada' : 'd-marcha']),
    bass: pick(['b-fundamental', 'b-caminhada', psx ? 'b-funk' : 'b-galope']),
    chords: pick(['c-vaivem', 'c-alberti', 'c-batidas', 'c-pulso']),
    melody: melodyVerse,
  }
  const refrao: SectionParts = {
    drums: pick(psx ? ['d-quebrada', 'd-disco', 'd-galope'] : ['d-galope', 'd-disco', 'd-marcha']),
    bass: pick(psx ? ['b-funk', 'b-oitavas'] : ['b-oitavas', 'b-galope']),
    chords: pick(psx ? ['c-batidas', 'c-arpejo', 'c-tapete'] : ['c-arpejo', 'c-batidas']),
    melody: melodyChorus,
  }

  return {
    ...base,
    vibe,
    key: Math.floor(Math.random() * 12),
    order: [...pick(TEMPLATES)],
    parts: {
      intro: {
        drums: pick(['d-leve', null]),
        bass: pick(['b-longo', null]),
        chords: pick(['c-tapete', 'c-vaivem', 'c-arpejo']),
        melody: Math.random() < 0.3 ? 'm-cantada' : null,
      },
      verso,
      refrao,
      ponte: {
        drums: pick(['d-meio', 'd-leve']),
        bass: pick(['b-longo', 'b-caminhada']),
        chords: pick(['c-tapete', 'c-vaivem']),
        melody: melodyBridge,
      },
      final: { ...refrao },
    },
    muted: [],
  }
}

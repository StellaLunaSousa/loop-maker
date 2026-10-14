import type { DrumHit, LaneId } from './types'

/**
 * A pitched note relative to the bar's chord: [step, length, chordTone, scaleStep?, octave?].
 * chordTone 0/1/2 = root/third/fifth, 3 = root an octave up. scaleStep moves
 * the note along the scale (passing tones). Notes on the beat always use
 * scaleStep 0, so whatever the chord is, the strong notes belong to it.
 */
export type RelNote = [step: number, len: number, tone: number, scaleStep?: number, octave?: number]

export interface DrumBar {
  /** 16 chars each. 'x' = hit, 'X' = accent, '.' = rest. */
  kick: string
  snare: string
  hat: string
  open?: string
}

interface BlockBase {
  id: string
  lane: LaneId
  name: string
  hint: string
  /** Rough energy 1–3, used by "Surpreenda-me" to shape the arrangement. */
  energy: 1 | 2 | 3
}

export interface DrumBlock extends BlockBase {
  lane: 'drums'
  bars: DrumBar[]
}

export interface PitchedBlock extends BlockBase {
  lane: 'bass' | 'chords' | 'melody'
  /** Either one bar repeated or a full four-bar phrase. */
  bars: RelNote[][]
  sustain?: boolean
}

export type Block = DrumBlock | PitchedBlock

const rep = (n: number, f: (i: number) => RelNote): RelNote[] => Array.from({ length: n }, (_, i) => f(i))
const chord = (step: number, len: number): RelNote[] => [0, 1, 2].map((t) => [step, len, t] as RelNote)

export const BLOCKS: Block[] = [
  // ── Batida ──────────────────────────────────────────────
  {
    id: 'd-marcha', lane: 'drums', name: 'Marcha', hint: 'Bumbo e caixa retos', energy: 2,
    bars: [
      { kick: 'X.......x.......', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.' },
      { kick: 'X.......x.x.....', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.' },
    ],
  },
  {
    id: 'd-galope', lane: 'drums', name: 'Galope', hint: 'Corrida em colcheias', energy: 3,
    bars: [
      { kick: 'X.....x.x.....x.', snare: '....X.......X...', hat: 'xxxxxxxxxxxxxxxx' },
      { kick: 'X.....x.x.x...x.', snare: '....X.......X..x', hat: 'xxxxxxxxxxxxxxxx' },
    ],
  },
  {
    id: 'd-quebrada', lane: 'drums', name: 'Quebrada', hint: 'Breakbeat dos anos 90', energy: 3,
    bars: [
      { kick: 'X.x.......xx....', snare: '....X..x.x..X..x', hat: 'x.x.x.x.x.x.x.x.' },
      { kick: 'X.x.......x.....', snare: '....X..x.x..X...', hat: 'x.x.x.x.x.x.x.x.', open: '..............x.' },
    ],
  },
  {
    id: 'd-disco', lane: 'drums', name: 'Pista', hint: 'Bumbo em todo tempo', energy: 3,
    bars: [{ kick: 'X...x...X...x...', snare: '....X.......X...', hat: 'x.......x.......', open: '..x...x...x...x.' }],
  },
  {
    id: 'd-meio', lane: 'drums', name: 'Meio-tempo', hint: 'Pesado e espaçado', energy: 2,
    bars: [
      { kick: 'X.........x.....', snare: '........X.......', hat: 'x.x.x.x.x.x.x.x.' },
      { kick: 'X.....x...x.....', snare: '........X.......', hat: 'x.x.x.x.x.x.x.x.' },
    ],
  },
  {
    id: 'd-leve', lane: 'drums', name: 'Leve', hint: 'Só o chimbal e um toque', energy: 1,
    bars: [{ kick: 'x...............', snare: '............x...', hat: '..x...x...x...x.' }],
  },

  // ── Baixo ───────────────────────────────────────────────
  {
    id: 'b-fundamental', lane: 'bass', name: 'Fundamental', hint: 'A nota base em colcheias', energy: 2,
    bars: [rep(8, (i) => [i * 2, 2, 0])],
  },
  {
    id: 'b-oitavas', lane: 'bass', name: 'Oitavas', hint: 'Pula entre grave e agudo', energy: 3,
    bars: [rep(8, (i) => [i * 2, 2, i % 2 ? 3 : 0])],
  },
  {
    id: 'b-galope', lane: 'bass', name: 'Galope', hint: 'Base, base, quinta', energy: 3,
    bars: [[[0, 3, 0], [3, 3, 0], [6, 2, 2], [8, 3, 0], [11, 3, 0], [14, 2, 2]]],
  },
  {
    id: 'b-caminhada', lane: 'bass', name: 'Caminhada', hint: 'Anda pelas notas do acorde', energy: 2,
    bars: [[[0, 4, 0], [4, 4, 1], [8, 4, 2], [12, 2, 1], [14, 2, 0, 1]]],
  },
  {
    id: 'b-funk', lane: 'bass', name: 'Suingue', hint: 'Sincopado e dançante', energy: 3,
    bars: [[[0, 3, 0], [3, 1, 0], [4, 2, 3], [7, 2, 0], [10, 2, 2], [12, 2, 3], [14, 2, 1]]],
  },
  {
    id: 'b-longo', lane: 'bass', name: 'Notas longas', hint: 'Sustenta a harmonia', energy: 1,
    bars: [[[0, 12, 0], [12, 4, 2]]],
  },

  // ── Acordes ─────────────────────────────────────────────
  {
    id: 'c-arpejo', lane: 'chords', name: 'Arpejo', hint: 'Sobe o acorde em semicolcheias', energy: 3,
    bars: [rep(16, (i) => [i, 1, i % 4])],
  },
  {
    id: 'c-vaivem', lane: 'chords', name: 'Vai e vem', hint: 'Sobe e desce em colcheias', energy: 2,
    bars: [rep(8, (i) => [i * 2, 2, [0, 1, 2, 3, 2, 1, 2, 1][i]])],
  },
  {
    id: 'c-alberti', lane: 'chords', name: 'Ciranda', hint: 'Base, quinta, terça, quinta', energy: 2,
    bars: [rep(8, (i) => [i * 2, 2, [0, 2, 1, 2][i % 4]])],
  },
  {
    id: 'c-batidas', lane: 'chords', name: 'Contratempo', hint: 'Acordes curtos entre os tempos', energy: 2,
    bars: [[2, 6, 10, 14].flatMap((s) => chord(s, 2))],
  },
  {
    id: 'c-pulso', lane: 'chords', name: 'Pulso', hint: 'Acorde em cada tempo', energy: 2,
    bars: [[0, 4, 8, 12].flatMap((s) => chord(s, 3))],
  },
  {
    id: 'c-tapete', lane: 'chords', name: 'Tapete', hint: 'Acorde longo e macio', energy: 1, sustain: true,
    bars: [chord(0, 16)],
  },

  // ── Melodia ─────────────────────────────────────────────
  {
    id: 'm-heroica', lane: 'melody', name: 'Heroica', hint: 'Fanfarra de abertura', energy: 3,
    bars: [
      [[0, 4, 0], [4, 2, 1], [6, 2, 2], [8, 6, 3], [14, 2, 2]],
      [[0, 3, 2], [3, 1, 2, -1], [4, 4, 1], [8, 8, 0]],
      [[0, 4, 0], [4, 2, 1], [6, 2, 2], [8, 6, 3], [14, 2, 2]],
      [[0, 4, 2], [4, 4, 1], [8, 8, 0]],
    ],
  },
  {
    id: 'm-saltitante', lane: 'melody', name: 'Saltitante', hint: 'Pulinhos alegres', energy: 2,
    bars: [
      [[0, 2, 0], [2, 2, 2], [4, 2, 1], [6, 2, 2], [8, 2, 3], [10, 2, 2], [12, 4, 1]],
      [[0, 2, 1], [2, 2, 1, 1], [4, 2, 2], [6, 2, 1, 1], [8, 4, 1], [12, 4, 0]],
      [[0, 2, 0], [2, 2, 2], [4, 2, 1], [6, 2, 2], [8, 2, 3], [10, 2, 2], [12, 4, 1]],
      [[0, 2, 2], [2, 2, 1, 1], [4, 2, 1], [6, 2, 0, 1], [8, 8, 0]],
    ],
  },
  {
    id: 'm-cantada', lane: 'melody', name: 'Cantada', hint: 'Notas longas, quase uma voz', energy: 1,
    bars: [
      [[0, 6, 2], [6, 2, 2, 1], [8, 8, 3]],
      [[0, 8, 2], [8, 4, 1], [12, 2, 1], [14, 2, 1, 1]],
      [[0, 6, 1], [6, 2, 2], [8, 8, 3]],
      [[0, 8, 1], [8, 8, 0]],
    ],
  },
  {
    id: 'm-corrida', lane: 'melody', name: 'Corrida', hint: 'Escalas rápidas', energy: 3,
    bars: [
      [[0, 1, 0], [1, 1, 0, 1], [2, 1, 1], [3, 1, 1, 1], [4, 2, 2], [6, 2, 1], [8, 1, 2], [9, 1, 2, 1], [10, 1, 3], [11, 1, 2, 1], [12, 4, 2]],
      [[0, 2, 3], [2, 2, 2], [4, 2, 1], [6, 2, 2], [8, 8, 1]],
      [[0, 1, 0], [1, 1, 0, 1], [2, 1, 1], [3, 1, 1, 1], [4, 2, 2], [6, 2, 1], [8, 1, 2], [9, 1, 2, 1], [10, 1, 3], [11, 1, 2, 1], [12, 4, 2]],
      [[0, 1, 3], [1, 1, 2, 1], [2, 1, 2], [3, 1, 1, 1], [4, 2, 1], [6, 2, 0, 1], [8, 8, 0]],
    ],
  },
  {
    id: 'm-eco', lane: 'melody', name: 'Pergunta e resposta', hint: 'Uma frase e seu eco', energy: 2,
    bars: [
      [[0, 2, 2], [2, 2, 3], [4, 4, 2]],
      [[8, 2, 2], [10, 2, 3], [12, 4, 2]],
      [[0, 2, 1], [2, 2, 2], [4, 4, 1]],
      [[8, 2, 1], [10, 2, 0, 1], [12, 4, 0]],
    ],
  },
  {
    id: 'm-sincopa', lane: 'melody', name: 'Sincopada', hint: 'Acentos fora do tempo', energy: 2,
    bars: [
      [[0, 3, 2], [3, 3, 3], [6, 2, 2], [10, 2, 1], [12, 4, 2]],
      [[0, 3, 1], [3, 3, 2], [6, 6, 1], [12, 4, 0]],
      [[0, 3, 2], [3, 3, 3], [6, 2, 2], [10, 2, 1], [12, 4, 2]],
      [[0, 3, 2], [3, 3, 1], [6, 10, 0]],
    ],
  },
]

export const BLOCK_BY_ID: Record<string, Block> = Object.fromEntries(BLOCKS.map((b) => [b.id, b]))

export function blocksForLane(lane: LaneId): Block[] {
  return BLOCKS.filter((b) => b.lane === lane)
}

/** Drum hits a bar holds, for drawing small rhythm previews. */
export function drumHits(bar: DrumBar): { step: number; hit: DrumHit; accent: boolean }[] {
  const out: { step: number; hit: DrumHit; accent: boolean }[] = []
  const rows: [string | undefined, DrumHit][] = [[bar.kick, 'kick'], [bar.snare, 'snare'], [bar.hat, 'hat'], [bar.open, 'openhat']]
  for (const [row, hit] of rows) {
    if (!row) continue
    for (let s = 0; s < 16; s++) {
      const ch = row[s]
      if (ch === 'x' || ch === 'X') out.push({ step: s, hit, accent: ch === 'X' })
    }
  }
  return out
}

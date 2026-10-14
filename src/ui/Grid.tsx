import { useEffect, useRef, useState } from 'react'
import { BLOCK_BY_ID } from '../music/blocks'
import { sectionChords } from '../music/compose'
import { SECTION_LABEL } from '../music/presets'
import { chordLabel } from '../music/theory'
import { LANES, MAX_SECTIONS, SECTION_TYPES, type LaneId, type SectionType, type Song } from '../music/types'
import { CloseIcon, LaneIcon, LoopIcon, PlusIcon, SpeakerIcon } from './icons'
import { MiniPattern } from './MiniPattern'

export const LANE_LABEL: Record<LaneId, string> = { drums: 'Batida', bass: 'Baixo', chords: 'Acordes', melody: 'Melodia' }

export interface Cell {
  col: number
  lane: LaneId
}

interface Props {
  song: Song
  selected: Cell | null
  playCol: number | null
  progress: number
  onSelect(cell: Cell): void
  onDropBlock(cell: Cell, blockId: string): void
  onSetType(col: number, type: SectionType): void
  onRemoveCol(col: number): void
  onAddCol(type: SectionType): void
  onToggleMute(lane: LaneId): void
  onLoopCol(col: number): void
}

export function Grid(p: Props) {
  const { song } = p
  const [menu, setMenu] = useState<number | 'add' | null>(null)
  const [hoverType, setHoverType] = useState<SectionType | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const selType = p.selected ? song.order[p.selected.col] : null
  const n = song.order.length

  return (
    <div className="grid-wrap">
      <div className="grid" style={{ gridTemplateColumns: `148px repeat(${n}, minmax(104px, 1fr)) 52px` }}>
        <div className="grid-corner">Estrutura</div>
        {song.order.map((type, col) => (
          <div
            key={'h' + col}
            className={`col-head type-${type} ${p.playCol === col ? 'is-playing' : ''}`}
            onMouseEnter={() => setHoverType(type)}
            onMouseLeave={() => setHoverType(null)}
          >
            <button className="col-label" onClick={() => setMenu(menu === col ? null : col)} aria-haspopup="menu">
              {SECTION_LABEL[type]}
              <span className="caret" aria-hidden>▾</span>
            </button>
            <div className="col-chords">
              {sectionChords(song, type).map((c, i) => (
                <span key={i}>{chordLabel(c, song.vibe, song.key)}</span>
              ))}
            </div>
            {p.playCol === col && <div className="col-progress" style={{ transform: `scaleX(${p.progress})` }} />}
            {menu === col && (
              <Menu onClose={() => setMenu(null)}>
                <div className="menu-title">Trocar seção</div>
                {SECTION_TYPES.map((t) => (
                  <button key={t} className={t === type ? 'is-current' : ''} onClick={() => { p.onSetType(col, t); setMenu(null) }}>
                    <span className={`swatch type-${t}`} /> {SECTION_LABEL[t]}
                  </button>
                ))}
                <hr />
                <button onClick={() => { p.onLoopCol(col); setMenu(null) }}><LoopIcon /> Ouvir em loop</button>
                <button disabled={n <= 1} onClick={() => { p.onRemoveCol(col); setMenu(null) }}><CloseIcon size={18} /> Remover</button>
              </Menu>
            )}
          </div>
        ))}
        <div className="col-head add-head">
          <button className="add-col" disabled={n >= MAX_SECTIONS} onClick={() => setMenu(menu === 'add' ? null : 'add')} title="Adicionar seção" aria-label="Adicionar seção">
            <PlusIcon />
          </button>
          {menu === 'add' && (
            <Menu onClose={() => setMenu(null)} alignRight>
              <div className="menu-title">Adicionar no fim</div>
              {SECTION_TYPES.map((t) => (
                <button key={t} onClick={() => { p.onAddCol(t); setMenu(null) }}>
                  <span className={`swatch type-${t}`} /> {SECTION_LABEL[t]}
                </button>
              ))}
            </Menu>
          )}
        </div>

        {LANES.map((lane) => {
          const muted = song.muted.includes(lane)
          return [
            <div key={lane + 'h'} className={`lane-head lane-${lane} ${muted ? 'is-muted' : ''}`}>
              <span className="lane-icon"><LaneIcon lane={lane} /></span>
              <span className="lane-name">{LANE_LABEL[lane]}</span>
              <button className="mute" onClick={() => p.onToggleMute(lane)} title={muted ? 'Ligar' : 'Silenciar'} aria-pressed={muted}>
                <SpeakerIcon off={muted} />
              </button>
            </div>,
            ...song.order.map((type, col) => {
              const id = song.parts[type][lane]
              const block = id ? BLOCK_BY_ID[id] : null
              const key = `${lane}-${col}`
              const isSel = p.selected?.col === col && p.selected.lane === lane
              const linked = !isSel && p.selected?.lane === lane && selType === type
              const twin = hoverType === type
              return (
                <button
                  key={key}
                  className={[
                    'cell', `lane-${lane}`, block ? 'is-filled' : 'is-empty',
                    isSel && 'is-selected', linked && 'is-linked', twin && 'is-twin',
                    p.playCol === col && 'is-playing', muted && 'is-muted', dragOver === key && 'is-dragover',
                  ].filter(Boolean).join(' ')}
                  onClick={() => p.onSelect({ col, lane })}
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes(`application/x-lane-${lane}`)) {
                      e.preventDefault()
                      setDragOver(key)
                    }
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => {
                    setDragOver(null)
                    const id = e.dataTransfer.getData('application/x-block')
                    if (id) p.onDropBlock({ col, lane }, id)
                  }}
                  aria-label={`${LANE_LABEL[lane]} no ${SECTION_LABEL[type]}: ${block ? block.name : 'vazio'}`}
                >
                  {block ? (
                    <>
                      <span className="cell-name">{block.name}</span>
                      <MiniPattern block={block} bars={block.lane === 'melody' ? 4 : 1} />
                    </>
                  ) : (
                    <span className="cell-plus"><PlusIcon size={16} /></span>
                  )}
                </button>
              )
            }),
            <div key={lane + 'pad'} className="lane-pad" />,
          ]
        })}
      </div>
    </div>
  )
}

function Menu({ children, onClose, alignRight }: { children: React.ReactNode; onClose(): void; alignRight?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    setTimeout(() => document.addEventListener('mousedown', down))
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key)
    }
  }, [onClose])
  return (
    <div ref={ref} className={`menu ${alignRight ? 'menu-right' : ''}`} role="menu">
      {children}
    </div>
  )
}

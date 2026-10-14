import { blocksForLane } from '../music/blocks'
import { SECTION_LABEL } from '../music/presets'
import { LANES, type Song } from '../music/types'
import { LANE_LABEL, type Cell } from './Grid'
import { CloseIcon, LaneIcon } from './icons'
import { MiniPattern } from './MiniPattern'

interface Props {
  song: Song
  selected: Cell
  onSelectLane(lane: Cell['lane']): void
  onPick(blockId: string | null): void
}

export function Palette({ song, selected, onSelectLane, onPick }: Props) {
  const type = song.order[selected.col]
  const current = song.parts[type][selected.lane]
  const copies = song.order.filter((t) => t === type).length
  const plural: Record<string, string> = { intro: 'Intros', verso: 'Versos', refrao: 'Refrões', ponte: 'Pontes', final: 'Finais' }

  return (
    <section className="palette" aria-label="Blocos">
      <div className="palette-head">
        <div className="lane-tabs" role="tablist">
          {LANES.map((l) => (
            <button key={l} role="tab" aria-selected={l === selected.lane} className={`lane-tab lane-${l}`} onClick={() => onSelectLane(l)}>
              <LaneIcon lane={l} size={18} /> {LANE_LABEL[l]}
            </button>
          ))}
        </div>
        <p className="palette-where">
          Escolhendo <strong>{LANE_LABEL[selected.lane].toLowerCase()}</strong> para o <strong>{SECTION_LABEL[type]}</strong>
          {copies > 1 && <span className="linked-note"> · vale para os {copies} {plural[type]}</span>}
        </p>
      </div>
      <div className="palette-blocks">
        {blocksForLane(selected.lane).map((b) => (
          <button
            key={b.id}
            className={`pblock lane-${b.lane} ${current === b.id ? 'is-current' : ''}`}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-block', b.id)
              e.dataTransfer.setData(`application/x-lane-${b.lane}`, '1')
              e.dataTransfer.effectAllowed = 'copy'
            }}
            onClick={() => onPick(b.id)}
          >
            <span className="pblock-top">
              <span className="pblock-name">{b.name}</span>
              <span className="energy" aria-label={`energia ${b.energy} de 3`}>
                {[1, 2, 3].map((i) => <i key={i} className={i <= b.energy ? 'on' : ''} />)}
              </span>
            </span>
            <MiniPattern block={b} bars={b.lane === 'melody' ? 4 : 2} />
            <span className="pblock-hint">{b.hint}</span>
          </button>
        ))}
        <button className={`pblock pblock-empty ${current === null ? 'is-current' : ''}`} onClick={() => onPick(null)}>
          <span className="pblock-top"><span className="pblock-name">Silêncio</span></span>
          <span className="pblock-x"><CloseIcon size={22} /></span>
          <span className="pblock-hint">Esta camada não toca aqui</span>
        </button>
      </div>
    </section>
  )
}

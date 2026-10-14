import { useCallback, useEffect, useMemo, useState } from 'react'
import { Player } from './audio/engine'
import { compile } from './music/compose'
import { defaultSong, surpriseSong } from './music/presets'
import { encodeSong, songFromLocation } from './music/share'
import { keyLabel } from './music/theory'
import { LANES, MAX_SECTIONS, STEPS_PER_SECTION, type ConsoleId, type LaneId, type SectionType, type Song, type Speed, type Vibe } from './music/types'
import { DonateDialog, ShareDialog } from './ui/Dialogs'
import { Grid, type Cell } from './ui/Grid'
import { DiceIcon, HeartIcon, PauseIcon, PlayIcon, RedoIcon, ShareIcon, UndoIcon } from './ui/icons'
import { Palette } from './ui/Palette'
import { Screen } from './ui/Screen'

interface History {
  past: Song[]
  present: Song
  future: Song[]
}

const VIBES: { id: Vibe; label: string }[] = [
  { id: 'alegre', label: 'Alegre' },
  { id: 'aventura', label: 'Aventura' },
  { id: 'melancolico', label: 'Melancólico' },
]
const SPEEDS: { id: Speed; label: string }[] = [
  { id: 'lento', label: 'Calmo' },
  { id: 'normal', label: 'Normal' },
  { id: 'rapido', label: 'Rápido' },
]
const CONSOLES: { id: ConsoleId; name: string; sub: string }[] = [
  { id: 'nes', name: '8-bit', sub: 'Cartucho' },
  { id: 'psx', name: '32-bit', sub: 'Disco' },
]

export default function App() {
  const [hist, setHist] = useState<History>(() => ({ past: [], present: songFromLocation() ?? defaultSong(), future: [] }))
  const song = hist.present
  const [rawSelected, setSelected] = useState<Cell>({ col: 1, lane: 'melody' })
  const selected = useMemo(
    () => (rawSelected.col < song.order.length ? rawSelected : { ...rawSelected, col: song.order.length - 1 }),
    [rawSelected, song.order.length],
  )
  const [playing, setPlaying] = useState(false)
  const [loopCol, setLoopCol] = useState<number | null>(null)
  const [pos, setPos] = useState<{ col: number; progress: number } | null>(null)
  const [dialog, setDialog] = useState<'share' | 'donate' | null>(null)
  const [player] = useState(() => new Player())

  const commit = useCallback((next: (s: Song) => Song) => {
    setHist((h) => {
      const n = next(h.present)
      if (n === h.present) return h
      return { past: [...h.past.slice(-80), h.present], present: n, future: [] }
    })
  }, [])
  const undo = useCallback(() => setHist((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h)), [])
  const redo = useCallback(() => setHist((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h)), [])

  useEffect(() => player.setSong(song), [player, song])
  useEffect(() => {
    document.documentElement.dataset.console = song.console
  }, [song.console])
  useEffect(() => {
    const t = setTimeout(() => history.replaceState(null, '', '#s=' + encodeSong(song)), 300)
    return () => clearTimeout(t)
  }, [song])

  // Follow the playhead for the grid highlight.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = ''
    const loop = () => {
      const p = player.position()
      if (p) {
        const col = Math.floor(p.step / STEPS_PER_SECTION)
        const progress = ((p.step % STEPS_PER_SECTION) + p.frac) / STEPS_PER_SECTION
        const k = col + ':' + Math.round(progress * 200)
        if (k !== last) {
          last = k
          setPos({ col, progress })
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playing, player])

  const play = useCallback(async (fromCol = 0, loop = false) => {
    await player.play(fromCol, loop)
    setPlaying(true)
    setLoopCol(loop ? fromCol : null)
  }, [player])
  const stop = useCallback(() => {
    player.stop()
    setPlaying(false)
    setLoopCol(null)
  }, [player])
  const toggle = useCallback(() => (playing ? stop() : play(0)), [playing, play, stop])

  const setPart = useCallback((cell: Cell, blockId: string | null) => {
    commit((s) => {
      const type = s.order[cell.col]
      if (s.parts[type][cell.lane] === blockId) return s
      return { ...s, parts: { ...s.parts, [type]: { ...s.parts[type], [cell.lane]: blockId } } }
    })
  }, [commit])

  const pick = (blockId: string | null) => {
    setPart(selected, blockId)
    // Hearing the choice right away is the whole point; loop the section if nothing is playing.
    if (!playing) play(selected.col, true)
  }

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.querySelector('dialog[open]')) return
      const mod = e.ctrlKey || e.metaKey
      if (e.code === 'Space') {
        e.preventDefault()
        toggle()
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        setPart(selected, null)
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        setSelected((s) => {
          const li = LANES.indexOf(s.lane)
          if (e.key === 'ArrowLeft') return { ...s, col: Math.max(0, s.col - 1) }
          if (e.key === 'ArrowRight') return { ...s, col: Math.min(song.order.length - 1, s.col + 1) }
          if (e.key === 'ArrowUp') return { ...s, lane: LANES[Math.max(0, li - 1)] }
          return { ...s, lane: LANES[Math.min(LANES.length - 1, li + 1)] }
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, undo, redo, setPart, selected, song.order.length])

  const scene = useMemo(() => ({ song, compiled: compile(song) }), [song])
  const getStep = useCallback(() => {
    const p = player.position()
    return p ? p.step + p.frac : selected.col * STEPS_PER_SECTION
  }, [player, selected.col])

  const set = <K extends keyof Song>(k: K, v: Song[K]) => commit((s) => (s[k] === v ? s : { ...s, [k]: v }))

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            <i /><i /><i /><i />
          </span>
          <span className="brand-name">Loop Maker</span>
        </div>
        <div className="console-pick" role="radiogroup" aria-label="Console">
          {CONSOLES.map((c) => (
            <button key={c.id} role="radio" aria-checked={song.console === c.id} className={`console console-${c.id}`} onClick={() => set('console', c.id)}>
              <span className="console-art" aria-hidden />
              <span className="console-text">
                <span className="console-name">{c.name}</span>
                <span className="console-sub">{c.sub}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="top-actions">
          <button className="btn btn-ghost" onClick={() => setDialog('donate')}><HeartIcon size={18} /> Apoiar</button>
          <button className="btn btn-primary" onClick={() => setDialog('share')}><ShareIcon size={18} /> Compartilhar</button>
        </div>
      </header>

      <main>
        <section className="stage">
          <div className="tv">
            <Screen scene={scene} getStep={getStep} />
          </div>
          <div className="controls">
            <input
              className="title-input"
              value={song.title}
              maxLength={60}
              onChange={(e) => {
                const title = e.target.value
                setHist((h) => ({ ...h, present: { ...h.present, title } }))
              }}
              aria-label="Nome da música"
            />
            <div className="transport">
              <button className={`play ${playing ? 'is-playing' : ''}`} onClick={toggle} aria-label={playing ? 'Parar' : 'Tocar'}>
                {playing ? <PauseIcon size={30} /> : <PlayIcon size={30} />}
              </button>
              <div className="transport-info">
                <span className="now">{playing ? (loopCol !== null ? 'Repetindo uma seção' : 'Tocando a música') : 'Pronta para tocar'}</span>
                <span className="key">Tom: {keyLabel(song.vibe, song.key)}</span>
              </div>
              <div className="history">
                <button className="icon-btn" onClick={undo} disabled={!hist.past.length} title="Desfazer (Ctrl+Z)" aria-label="Desfazer"><UndoIcon /></button>
                <button className="icon-btn" onClick={redo} disabled={!hist.future.length} title="Refazer (Ctrl+Y)" aria-label="Refazer"><RedoIcon /></button>
              </div>
            </div>
            <div className="field">
              <span className="field-label">Clima</span>
              <Segmented options={VIBES} value={song.vibe} onChange={(v) => set('vibe', v)} />
            </div>
            <div className="field">
              <span className="field-label">Ritmo</span>
              <Segmented options={SPEEDS} value={song.speed} onChange={(v) => set('speed', v)} />
            </div>
            <button className="btn btn-surprise" onClick={() => { commit((s) => surpriseSong(s)); setSelected({ col: 1, lane: 'melody' }) }}>
              <DiceIcon /> Surpreenda-me
            </button>
          </div>
        </section>

        <Grid
          song={song}
          selected={selected}
          playCol={playing ? pos?.col ?? null : null}
          progress={pos?.progress ?? 0}
          onSelect={setSelected}
          onDropBlock={(cell, id) => { setSelected(cell); setPart(cell, id) }}
          onSetType={(col, type: SectionType) => commit((s) => ({ ...s, order: s.order.map((t, i) => (i === col ? type : t)) }))}
          onRemoveCol={(col) => commit((s) => (s.order.length <= 1 ? s : { ...s, order: s.order.filter((_, i) => i !== col) }))}
          onAddCol={(type) => commit((s) => (s.order.length >= MAX_SECTIONS ? s : { ...s, order: [...s.order, type] }))}
          onToggleMute={(lane: LaneId) => commit((s) => ({ ...s, muted: s.muted.includes(lane) ? s.muted.filter((l) => l !== lane) : [...s.muted, lane] }))}
          onLoopCol={(col) => play(col, true)}
        />

        <Palette song={song} selected={selected} onSelectLane={(lane) => setSelected((s) => ({ ...s, lane }))} onPick={pick} />
      </main>

      <footer className="foot">
        Sons originais inspirados em consoles clássicos. Sem afiliação com nenhuma fabricante de videogame.
      </footer>

      {dialog === 'share' && <ShareDialog song={song} onClose={() => setDialog(null)} onDonate={() => setDialog('donate')} />}
      {dialog === 'donate' && <DonateDialog onClose={() => setDialog(null)} />}
    </div>
  )
}

function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange(v: T): void }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={o.id === value} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

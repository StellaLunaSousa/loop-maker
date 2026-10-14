import { useEffect, useRef, useState } from 'react'
import { DONATE, SITE_URL } from '../config'
import { renderSong } from '../audio/engine'
import { songUrl } from '../music/share'
import type { Song } from '../music/types'
import { audioBufferToWav, downloadBlob, safeFilename } from '../export/wav'
import { VIDEO_SIZES, type VideoFormat } from '../export/formats'
import { CloseIcon, CopyIcon, DownloadIcon, HeartIcon, ShareIcon } from './icons'

function Modal({ title, onClose, children, wide }: { title: string; onClose(): void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Fechar"><CloseIcon /></button>
      </div>
      {children}
    </dialog>
  )
}

export function ShareDialog({ song, onClose, onDonate }: { song: Song; onClose(): void; onDonate(): void }) {
  const [format, setFormat] = useState<VideoFormat>('story')
  const [progress, setProgress] = useState<number | null>(null)
  const [video, setVideo] = useState<{ blob: Blob; url: string; format: VideoFormat } | null>(null)
  const [canVideo, setCanVideo] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [wavBusy, setWavBusy] = useState(false)
  const link = songUrl(song)
  const name = safeFilename(song.title)
  const shareText = `Fiz "${song.title}" no Loop Maker 🎮🎵`

  useEffect(() => {
    import('../export/video').then((m) => m.videoSupported()).then(setCanVideo, () => setCanVideo(false))
  }, [])
  useEffect(() => () => { if (video) URL.revokeObjectURL(video.url) }, [video])

  async function makeVideo() {
    setError(null)
    setProgress(0)
    try {
      const { renderVideo } = await import('../export/video')
      const blob = await renderVideo(song, format, setProgress)
      setVideo({ blob, url: URL.createObjectURL(blob), format })
    } catch (e) {
      console.error(e)
      setError('Não consegui gerar o vídeo neste navegador. Tente no Chrome ou Edge atualizados, ou baixe só o áudio.')
    } finally {
      setProgress(null)
    }
  }

  async function shareVideo() {
    if (!video) return
    const file = new File([video.blob], `${name}.mp4`, { type: 'video/mp4' })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: shareText }).catch(() => {})
    } else downloadBlob(video.blob, `${name}.mp4`)
  }

  async function wav() {
    setWavBusy(true)
    try {
      downloadBlob(audioBufferToWav(await renderSong(song)), `${name}.wav`)
    } finally {
      setWavBusy(false)
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const publicLink = SITE_URL ? link.replace(window.location.origin + window.location.pathname, SITE_URL) : link
  const xUrl = `https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(publicLink)}`
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + publicLink)}`

  return (
    <Modal title="Compartilhar" onClose={onClose} wide>
      <div className="share-grid">
        <div className="share-video">
          <h3>Vídeo para as redes</h3>
          <div className="format-pick" role="radiogroup">
            {(Object.keys(VIDEO_SIZES) as VideoFormat[]).map((f) => (
              <button key={f} role="radio" aria-checked={format === f} className={`format format-${f}`} onClick={() => setFormat(f)}>
                <span className="format-shape" />
                <span className="format-label">{VIDEO_SIZES[f].label}</span>
                <span className="format-hint">{VIDEO_SIZES[f].hint}</span>
              </button>
            ))}
          </div>
          {canVideo === false && <p className="note">Este navegador não gera vídeo. No Chrome ou Edge funciona.</p>}
          {progress !== null ? (
            <div className="progress"><div style={{ width: `${Math.round(progress * 100)}%` }} /><span>Gerando vídeo… {Math.round(progress * 100)}%</span></div>
          ) : (
            <button className="btn btn-primary" disabled={!canVideo} onClick={makeVideo}>
              {video && video.format === format ? 'Gerar de novo' : 'Gerar vídeo'}
            </button>
          )}
          {error && <p className="note note-error">{error}</p>}
          {video && (
            <div className="video-result">
              <video src={video.url} controls playsInline className={`video-${video.format}`} />
              <div className="row">
                <button className="btn" onClick={() => downloadBlob(video.blob, `${name}.mp4`)}><DownloadIcon /> Baixar MP4</button>
                <button className="btn" onClick={shareVideo}><ShareIcon size={18} /> Compartilhar</button>
              </div>
              <p className="note">No celular, "Compartilhar" abre direto o Instagram, TikTok ou WhatsApp. No computador, baixe e poste pelo app.</p>
            </div>
          )}
        </div>
        <div className="share-side">
          <h3>Link da música</h3>
          <p className="note">Quem abrir o link ouve e pode fazer um remix.</p>
          <div className="link-box">
            <input readOnly value={publicLink} onFocus={(e) => e.currentTarget.select()} aria-label="Link da música" />
            <button className="btn" onClick={copy}><CopyIcon /> {copied ? 'Copiado!' : 'Copiar'}</button>
          </div>
          <div className="row">
            <a className="btn" href={xUrl} target="_blank" rel="noreferrer">Postar no X</a>
            <a className="btn" href={waUrl} target="_blank" rel="noreferrer">WhatsApp</a>
          </div>
          <h3>Só o áudio</h3>
          <button className="btn" onClick={wav} disabled={wavBusy}><DownloadIcon /> {wavBusy ? 'Preparando…' : 'Baixar WAV'}</button>
          <button className="donate-inline" onClick={onDonate}><HeartIcon size={18} /> Curtiu? Apoie o Loop Maker</button>
        </div>
      </div>
    </Modal>
  )
}

export function DonateDialog({ onClose }: { onClose(): void }) {
  const [copied, setCopied] = useState(false)
  const has = DONATE.kofi || DONATE.pix
  return (
    <Modal title="Apoiar o Loop Maker" onClose={onClose}>
      <p className="donate-lead">O Loop Maker é gratuito e sem anúncios. Se ele te fez sorrir, um cafezinho ajuda a manter o projeto e a trazer mais consoles.</p>
      {!has && <p className="note">As formas de apoio chegam em breve.</p>}
      {DONATE.pix && (
        <div className="pix">
          <h3>Pix</h3>
          {DONATE.pixName && <p className="note">{DONATE.pixName}</p>}
          <div className="link-box">
            <input readOnly value={DONATE.pix} aria-label="Chave Pix" />
            <button className="btn" onClick={async () => { await navigator.clipboard.writeText(DONATE.pix); setCopied(true) }}>
              <CopyIcon /> {copied ? 'Copiada!' : 'Copiar chave'}
            </button>
          </div>
        </div>
      )}
      {DONATE.kofi && (
        <a className="btn btn-primary" href={DONATE.kofi} target="_blank" rel="noreferrer"><HeartIcon size={18} /> Apoiar no Ko-fi</a>
      )}
    </Modal>
  )
}

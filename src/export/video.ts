import { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, canEncodeAudio, canEncodeVideo } from 'mediabunny'
import { renderSong } from '../audio/engine'
import { compile, stepSeconds } from '../music/compose'
import type { Song } from '../music/types'
import { drawFrame } from '../viz/visualizer'
import { VIDEO_SIZES, type VideoFormat } from './formats'

/** H.264 is what Instagram and X expect; VP9 is a fallback for browsers without it. */
async function pickVideoCodec(w: number, h: number): Promise<'avc' | 'vp9' | null> {
  if (typeof VideoEncoder === 'undefined') return null
  if (await canEncodeVideo('avc', { width: w, height: h })) return 'avc'
  if (await canEncodeVideo('vp9', { width: w, height: h })) return 'vp9'
  return null
}

export async function videoSupported(): Promise<boolean> {
  return (await pickVideoCodec(1080, 1920)) !== null
}

const FPS = 30
const LEAD_IN = 0.05

/**
 * Renders the song to an MP4 entirely in the browser: audio offline with the
 * same engine as playback, frames drawn by the same visualizer as the preview,
 * and both encoded with WebCodecs.
 */
export async function renderVideo(song: Song, format: VideoFormat, onProgress: (p: number) => void): Promise<Blob> {
  await document.fonts.load('16px "Press Start 2P"')
  await document.fonts.load('700 16px "Exo 2"')
  const { w, h } = VIDEO_SIZES[format]
  onProgress(0.02)
  const audio = await renderSong(song)
  onProgress(0.15)

  const codec = await pickVideoCodec(w, h)
  if (!codec) throw new Error('No video encoder available')
  const canvas = new OffscreenCanvas(w, h)
  const g = canvas.getContext('2d')!
  const audioCodec = (await canEncodeAudio('aac')) ? 'aac' : 'opus'
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() })
  const video = new CanvasSource(canvas, { codec, quality: QUALITY_HIGH })
  const sound = new AudioBufferSource({ codec: audioCodec, quality: QUALITY_HIGH })
  output.addVideoTrack(video, { frameRate: FPS })
  output.addAudioTrack(sound)
  await output.start()

  const scene = { song, compiled: compile(song) }
  const stepSec = stepSeconds(song)
  const frames = Math.ceil(audio.duration * FPS)
  for (let f = 0; f < frames; f++) {
    const t = f / FPS
    drawFrame(g, w, h, scene, (t - LEAD_IN) / stepSec)
    await video.add(t, 1 / FPS)
    if (f % 15 === 0) onProgress(0.15 + 0.8 * (f / frames))
  }
  await sound.add(audio)
  await output.finalize()
  onProgress(1)
  return new Blob([output.target.buffer!], { type: 'video/mp4' })
}

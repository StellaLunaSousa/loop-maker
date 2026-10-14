/** 16-bit PCM WAV, the format every editor and phone understands. */
export function audioBufferToWav(buf: AudioBuffer): Blob {
  const channels = buf.numberOfChannels
  const frames = buf.length
  const bytes = 44 + frames * channels * 2
  const view = new DataView(new ArrayBuffer(bytes))
  const str = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  view.setUint32(4, bytes - 8, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, buf.sampleRate, true)
  view.setUint32(28, buf.sampleRate * channels * 2, true)
  view.setUint16(32, channels * 2, true)
  view.setUint16(34, 16, true)
  str(36, 'data')
  view.setUint32(40, frames * channels * 2, true)
  const data = Array.from({ length: channels }, (_, c) => buf.getChannelData(c))
  let o = 44
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]))
      view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      o += 2
    }
  }
  return new Blob([view], { type: 'audio/wav' })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function safeFilename(title: string): string {
  return (
    title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'loop-maker'
  )
}

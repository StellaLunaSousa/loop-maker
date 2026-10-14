import { BLOCK_BY_ID } from './blocks'
import { defaultSong } from './presets'
import { LANES, MAX_SECTIONS, SECTION_TYPES, type Song } from './types'

/**
 * The whole song travels inside the link, so sharing needs no server and
 * whoever opens the link can keep editing it (a remix).
 */
export function encodeSong(song: Song): string {
  const compact = [
    1,
    song.title,
    song.console,
    song.vibe,
    song.speed,
    song.key,
    song.order.map((t) => SECTION_TYPES.indexOf(t)).join(''),
    SECTION_TYPES.map((t) => LANES.map((l) => song.parts[t][l] ?? '').join(',')).join(';'),
    song.muted.map((l) => LANES.indexOf(l)).join(''),
  ]
  const bytes = new TextEncoder().encode(JSON.stringify(compact))
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeSong(code: string): Song | null {
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    const [v, title, console, vibe, speed, key, order, parts, muted] = JSON.parse(new TextDecoder().decode(bytes))
    if (v !== 1) return null
    const song = defaultSong()
    song.title = String(title).slice(0, 60)
    if (console === 'nes' || console === 'psx') song.console = console
    if (['alegre', 'aventura', 'melancolico'].includes(vibe)) song.vibe = vibe
    if (['lento', 'normal', 'rapido'].includes(speed)) song.speed = speed
    song.key = Math.abs(Number(key) | 0) % 12
    const types = String(order).split('').map((i) => SECTION_TYPES[Number(i)]).filter(Boolean)
    if (types.length) song.order = types.slice(0, MAX_SECTIONS)
    String(parts).split(';').forEach((row, ti) => {
      const type = SECTION_TYPES[ti]
      if (!type) return
      row.split(',').forEach((id, li) => {
        const lane = LANES[li]
        if (lane) song.parts[type][lane] = BLOCK_BY_ID[id]?.lane === lane ? id : null
      })
    })
    song.muted = String(muted).split('').map((i) => LANES[Number(i)]).filter(Boolean)
    return song
  } catch {
    return null
  }
}

export function songUrl(song: Song): string {
  const url = new URL(window.location.href)
  url.hash = 's=' + encodeSong(song)
  return url.toString()
}

export function songFromLocation(): Song | null {
  const m = window.location.hash.match(/s=([A-Za-z0-9_-]+)/)
  return m ? decodeSong(m[1]) : null
}

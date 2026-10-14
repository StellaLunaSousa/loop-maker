import type { LaneId } from '../music/types'

type P = { size?: number }
const svg = (size: number, children: React.ReactNode, fill = false) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
)

export const PlayIcon = ({ size = 24 }: P) => svg(size, <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" />, true)
export const PauseIcon = ({ size = 24 }: P) => svg(size, <><rect x="5" y="4" width="5" height="16" rx="1" /><rect x="14" y="4" width="5" height="16" rx="1" /></>, true)
export const UndoIcon = ({ size = 20 }: P) => svg(size, <><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>)
export const RedoIcon = ({ size = 20 }: P) => svg(size, <><path d="m15 14 5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h3" /></>)
export const DiceIcon = ({ size = 20 }: P) => svg(size, <><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" /><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /></>)
export const ShareIcon = ({ size = 20 }: P) => svg(size, <><path d="M12 3v13" /><path d="m7 8 5-5 5 5" /><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></>)
export const HeartIcon = ({ size = 20 }: P) => svg(size, <path d="M12 20s-7-4.4-9.2-9A5 5 0 0 1 12 6a5 5 0 0 1 9.2 5C19 15.6 12 20 12 20Z" />)
export const SpeakerIcon = ({ size = 18, off }: P & { off?: boolean }) =>
  svg(size, <><path d="M4 9v6h4l5 4V5L8 9H4Z" />{off ? <path d="m17 9 5 6M22 9l-5 6" /> : <path d="M17 8.5a5 5 0 0 1 0 7" />}</>)
export const PlusIcon = ({ size = 20 }: P) => svg(size, <><path d="M12 5v14" /><path d="M5 12h14" /></>)
export const CloseIcon = ({ size = 20 }: P) => svg(size, <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>)
export const LoopIcon = ({ size = 18 }: P) => svg(size, <><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></>)
export const CopyIcon = ({ size = 18 }: P) => svg(size, <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>)
export const DownloadIcon = ({ size = 18 }: P) => svg(size, <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>)

export function LaneIcon({ lane, size = 20 }: { lane: LaneId; size?: number }) {
  switch (lane) {
    case 'drums':
      return svg(size, <><ellipse cx="12" cy="8" rx="8" ry="3" /><path d="M4 8v8c0 1.7 3.6 3 8 3s8-1.3 8-3V8" /></>)
    case 'bass':
      return svg(size, <path d="M2 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0 2 3 2 3" />)
    case 'chords':
      return svg(size, <><rect x="4" y="4" width="16" height="4" rx="1" /><rect x="4" y="10" width="16" height="4" rx="1" /><rect x="4" y="16" width="16" height="4" rx="1" /></>)
    case 'melody':
      return svg(size, <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>)
  }
}

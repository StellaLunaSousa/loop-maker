import { drumHits, type Block } from '../music/blocks'

const ROW = { kick: 3, snare: 1.8, hat: 0.6, openhat: 0.6 } as Record<string, number>

/** A tiny picture of a block's first bar(s), so blocks can be told apart at a glance. */
export function MiniPattern({ block, bars = 1 }: { block: Block; bars?: number }) {
  const w = 16 * bars
  const dots: { x: number; y: number; len: number }[] = []
  for (let b = 0; b < bars; b++) {
    if (block.lane === 'drums') {
      for (const h of drumHits(block.bars[b % block.bars.length])) dots.push({ x: b * 16 + h.step, y: ROW[h.hit] ?? 1, len: 0.7 })
    } else {
      for (const [step, len, tone, scaleStep = 0] of block.bars[b % block.bars.length]) {
        dots.push({ x: b * 16 + step, y: 3.2 - (tone * 2 + scaleStep) / 2.6, len: Math.max(0.7, len - 0.3) })
      }
    }
  }
  return (
    <svg className="mini" viewBox={`0 -0.2 ${w} 4`} preserveAspectRatio="none" aria-hidden>
      {dots.map((d, i) => (
        <rect key={i} x={d.x + 0.15} y={d.y} width={d.len} height={0.55} rx={0.2} />
      ))}
    </svg>
  )
}

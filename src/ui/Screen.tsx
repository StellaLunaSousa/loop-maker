import { useEffect, useLayoutEffect, useRef } from 'react'
import type { Scene } from '../viz/visualizer'
import { drawFrame } from '../viz/visualizer'

/** The little TV: the same visualizer the exported video uses, drawn live. */
export function Screen({ scene, getStep }: { scene: Scene; getStep(): number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef(scene)
  const stepRef = useRef(getStep)
  useLayoutEffect(() => {
    sceneRef.current = scene
    stepRef.current = getStep
  })

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const c = ref.current
      if (c) {
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        const w = Math.round(c.clientWidth * dpr)
        const h = Math.round(c.clientHeight * dpr)
        if (c.width !== w || c.height !== h) {
          c.width = w
          c.height = h
        }
        const g = c.getContext('2d')
        if (g && w > 0 && h > 0) drawFrame(g, w, h, sceneRef.current, stepRef.current())
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={ref} className="screen" aria-label="Visualização da música" />
}

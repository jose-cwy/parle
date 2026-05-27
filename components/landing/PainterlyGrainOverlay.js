import { useEffect, useRef } from 'react'
import {
  bindFullscreenQuad,
  createFullscreenQuad,
  createProgram,
  resizeCanvasToDisplaySize,
} from '../../lib/painterlyWebGL'
import { GRAIN_FRAG, PAINTERLY_VERT } from './shaders/sunsetPainterlyShaders'

export default function PainterlyGrainOverlay({ animate = true }) {
  const canvasRef = useRef(null)
  const animateRef = useRef(animate)

  animateRef.current = animate

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const gl = canvas.getContext('webgl', { alpha: true, antialias: false })
    if (!gl) return undefined

    let program
    let buffer
    let raf = 0
    let visible = true
    let start = performance.now()

    try {
      program = createProgram(gl, PAINTERLY_VERT, GRAIN_FRAG)
      buffer = createFullscreenQuad(gl)
    } catch {
      return undefined
    }

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    const uTime = gl.getUniformLocation(program, 'uTime')
    const uResolution = gl.getUniformLocation(program, 'uResolution')

    const draw = (now) => {
      if (!visible) {
        raf = requestAnimationFrame(draw)
        return
      }

      resizeCanvasToDisplaySize(canvas)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      const t = animateRef.current ? (now - start) * 0.001 : 0

      gl.useProgram(program)
      bindFullscreenQuad(gl, program, buffer)
      gl.uniform1f(uTime, t)
      gl.uniform2f(uResolution, canvas.width, canvas.height)
      gl.drawArrays(gl.TRIANGLES, 0, 6)

      raf = requestAnimationFrame(draw)
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    })
    observer.observe(canvas)
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      if (buffer) gl.deleteBuffer(buffer)
      if (program) gl.deleteProgram(program)
    }
  }, [])

  return <canvas ref={canvasRef} className="sunsetLayers__grainCanvas" aria-hidden="true" />
}

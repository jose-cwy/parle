import { useEffect, useRef } from 'react'
import {
  bindFullscreenQuad,
  createFullscreenQuad,
  createProgram,
  resizeCanvasToDisplaySize,
} from '../../lib/painterlyWebGL'
import { PAINTERLY_VERT, SKY_FRAG } from './shaders/sunsetPainterlyShaders'

export default function PainterlySkyShader({ scrollProgress = 0, animate = true }) {
  const canvasRef = useRef(null)
  const scrollRef = useRef(scrollProgress)
  const animateRef = useRef(animate)

  scrollRef.current = scrollProgress
  animateRef.current = animate

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'high-performance' })
    if (!gl) return undefined

    let program
    let buffer
    let raf = 0
    let visible = true
    let start = performance.now()

    try {
      program = createProgram(gl, PAINTERLY_VERT, SKY_FRAG)
      buffer = createFullscreenQuad(gl)
    } catch {
      return undefined
    }

    const uTime = gl.getUniformLocation(program, 'uTime')
    const uScroll = gl.getUniformLocation(program, 'uScroll')
    const uResolution = gl.getUniformLocation(program, 'uResolution')

    const draw = (now) => {
      if (!visible) {
        raf = requestAnimationFrame(draw)
        return
      }

      const resized = resizeCanvasToDisplaySize(canvas)
      if (resized) gl.viewport(0, 0, canvas.width, canvas.height)

      const t = animateRef.current ? (now - start) * 0.001 : 0

      gl.useProgram(program)
      bindFullscreenQuad(gl, program, buffer)
      gl.uniform1f(uTime, t)
      gl.uniform1f(uScroll, scrollRef.current)
      gl.uniform2f(uResolution, canvas.width, canvas.height)
      gl.drawArrays(gl.TRIANGLES, 0, 6)

      raf = requestAnimationFrame(draw)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
      },
      { threshold: 0.05 }
    )
    observer.observe(canvas)
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      if (buffer) gl.deleteBuffer(buffer)
      if (program) gl.deleteProgram(program)
    }
  }, [])

  return <canvas ref={canvasRef} className="sunsetLayers__skyCanvas" aria-hidden="true" />
}

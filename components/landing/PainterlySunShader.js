import { useEffect, useRef } from 'react'
import {
  bindFullscreenQuad,
  createFullscreenQuad,
  createProgram,
  resizeCanvasToDisplaySize,
} from '../../lib/painterlyWebGL'
import { PAINTERLY_VERT, SUN_FRAG } from './shaders/sunsetPainterlyShaders'

export default function PainterlySunShader({ glowOpacity = 0.55, animate = true }) {
  const canvasRef = useRef(null)
  const glowRef = useRef(glowOpacity)
  const animateRef = useRef(animate)

  animateRef.current = animate

  useEffect(() => {
    glowRef.current = glowOpacity
  }, [glowOpacity])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true })
    if (!gl) return undefined

    let program
    let buffer
    let raf = 0
    let start = performance.now()

    try {
      program = createProgram(gl, PAINTERLY_VERT, SUN_FRAG)
      buffer = createFullscreenQuad(gl)
    } catch {
      return undefined
    }

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    const uTime = gl.getUniformLocation(program, 'uTime')
    const uGlow = gl.getUniformLocation(program, 'uGlow')

    const draw = (now) => {
      resizeCanvasToDisplaySize(canvas)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      const t = animateRef.current ? (now - start) * 0.001 : 0

      gl.useProgram(program)
      bindFullscreenQuad(gl, program, buffer)
      gl.uniform1f(uTime, t)
      gl.uniform1f(uGlow, glowRef.current)
      gl.drawArrays(gl.TRIANGLES, 0, 6)

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      if (buffer) gl.deleteBuffer(buffer)
      if (program) gl.deleteProgram(program)
    }
  }, [])

  return <canvas ref={canvasRef} className="sunsetLayers__sunCanvas" aria-hidden="true" />
}

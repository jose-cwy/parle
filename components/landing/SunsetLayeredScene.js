import dynamic from 'next/dynamic'
import { motion, useMotionValueEvent, useReducedMotion, useTransform } from 'framer-motion'
import { useState } from 'react'

const PainterlySkyShader = dynamic(() => import('./PainterlySkyShader'), { ssr: false })
const PainterlySunShader = dynamic(() => import('./PainterlySunShader'), { ssr: false })
const PainterlyGrainOverlay = dynamic(() => import('./PainterlyGrainOverlay'), { ssr: false })

function CloudsSvg() {
  return (
    <svg className="sunsetLayers__cloudsSvg" viewBox="0 0 1440 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <filter id="cloudPainterly" x="-20%" y="-30%" width="140%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.018" numOctaves="4" seed="8" result="noiseA" />
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.06" numOctaves="2" seed="2" result="noiseB" />
          <feComposite in="noiseA" in2="noiseB" operator="arithmetic" k1="0.6" k2="0.6" k3="0.0" k4="0.0" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="10" xChannelSelector="R" yChannelSelector="G" result="disp" />
          <feGaussianBlur in="disp" stdDeviation="1.6" />
        </filter>
        <linearGradient id="cloudFillA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2c2148" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#4a3b60" stopOpacity="0.98" />
          <stop offset="100%" stopColor="#b7774d" stopOpacity="0.65" />
        </linearGradient>
        <linearGradient id="cloudFillB" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b2a58" stopOpacity="0.92" />
          <stop offset="55%" stopColor="#4a3b60" stopOpacity="0.98" />
          <stop offset="100%" stopColor="#6b4a72" stopOpacity="0.85" />
        </linearGradient>
        <filter id="cloudSoft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      {/* Far wisps near horizon */}
      <g filter="url(#cloudSoft)" opacity="0.35">
        <path
          d="M70 290 C170 265 255 305 340 287 C420 270 500 292 585 278 C690 260 780 305 880 286 C980 268 1080 292 1170 278 C1260 265 1330 285 1390 276"
          fill="none"
          stroke="#caa06c"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M140 320 C260 300 355 342 460 322 C560 302 670 332 780 314 C900 295 1040 334 1160 314"
          fill="none"
          stroke="#7b5a78"
          strokeWidth="10"
          strokeLinecap="round"
          opacity="0.5"
        />
      </g>

      {/* Main cloud masses (organic silhouettes, painterly displacement) */}
      <g filter="url(#cloudPainterly)" opacity="0.96">
        <path
          d="M70 150 C120 120 185 120 235 138 C270 108 338 98 392 116 C448 84 530 92 568 128 C628 112 694 122 730 152 C808 120 910 120 970 156 C1040 120 1125 120 1188 154 C1266 192 1306 230 1318 270 C1188 292 996 290 820 278 C650 266 488 268 320 276 C198 282 110 264 80 238 C56 216 52 176 70 150 Z"
          fill="url(#cloudFillB)"
        />
        <path
          d="M820 110 C872 82 950 86 1008 114 C1074 78 1168 86 1228 128 C1292 104 1362 126 1388 166 C1418 212 1402 252 1366 268 C1282 304 1114 304 980 290 C872 278 808 250 792 212 C772 168 786 134 820 110 Z"
          fill="url(#cloudFillA)"
          opacity="0.92"
        />
        <path
          d="M128 208 C170 178 230 182 280 206 C328 172 392 176 430 212 C468 196 518 210 540 242 C560 274 542 306 510 314 C452 330 330 330 242 314 C176 304 120 278 112 248 C104 226 110 218 128 208 Z"
          fill="#3a2a56"
          opacity="0.8"
        />
      </g>
    </svg>
  )
}

function OceanSvg() {
  return (
    <svg className="sunsetLayers__oceanSvg" viewBox="0 0 1440 640" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="oceanHaze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f6c077" stopOpacity="0.22" />
          <stop offset="35%" stopColor="#caa06c" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#0c1633" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="waveDeep" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4969b6" stopOpacity="0.68" />
          <stop offset="55%" stopColor="#2a3f7a" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#1d2352" />
        </linearGradient>
        <linearGradient id="waveMid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6a87d6" stopOpacity="0.55" />
          <stop offset="42%" stopColor="#3d5a9e" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#243060" />
        </linearGradient>
        <linearGradient id="waveFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#88a6ff" stopOpacity="0.35" />
          <stop offset="28%" stopColor="#4a6bb5" stopOpacity="0.96" />
          <stop offset="100%" stopColor="#152040" />
        </linearGradient>
        <filter id="waveBrush" x="-6%" y="-8%" width="112%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.09" numOctaves="3" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="8" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="waveShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>
      {/* Atmospheric haze at the horizon */}
      <rect x="0" y="120" width="1440" height="220" fill="url(#oceanHaze)" opacity="0.9" />

      {/* Deeper, layered waves: background → foreground (each with subtle shadow separation) */}
      <g filter="url(#waveBrush)">
        <path d="M0 175 C160 150 320 190 470 170 C650 146 810 196 980 168 C1140 144 1300 182 1440 162 L1440 640 L0 640 Z" fill="url(#waveDeep)" opacity="0.72" />
        <path d="M0 220 C190 185 360 245 540 214 C720 182 870 250 1030 220 C1180 194 1310 234 1440 212 L1440 640 L0 640 Z" fill="url(#waveDeep)" opacity="0.9" />

        <path d="M0 270 C170 240 390 310 590 270 C770 234 940 312 1140 274 C1288 246 1388 294 1440 278 L1440 640 L0 640 Z" fill="url(#waveMid)" opacity="0.98" />
        <path d="M0 322 C150 300 330 350 520 324 C700 298 890 356 1080 326 C1250 300 1360 334 1440 326 L1440 640 L0 640 Z" fill="#1a2850" opacity="0.98" />

        <path d="M0 374 C200 350 420 410 660 378 C890 346 1100 412 1320 380 C1400 368 1424 376 1440 380 L1440 640 L0 640 Z" fill="#121f45" opacity="0.98" />
        <path d="M0 430 C190 404 420 456 650 428 C870 402 1100 462 1310 434 C1390 424 1420 430 1440 432 L1440 640 L0 640 Z" fill="url(#waveFront)" opacity="1" />
      </g>

      {/* Soft shadowing between layers (subtle depth cue) */}
      <g filter="url(#waveShadow)" opacity="0.12">
        <path d="M0 268 C170 238 390 308 590 268 C770 232 940 310 1140 272 C1288 244 1388 292 1440 276" stroke="#000" strokeWidth="22" fill="none" />
        <path d="M0 372 C200 348 420 408 660 376 C890 344 1100 410 1320 378 C1400 366 1424 374 1440 378" stroke="#000" strokeWidth="24" fill="none" />
      </g>

      {/* Painted crest highlights (more organic strokes, varied thickness/opacity) */}
      <g className="sunsetLayers__waveHighlights" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.6">
        <path d="M70 212 C190 190 320 236 450 206" stroke="#8fb0ff" strokeWidth="9" opacity="0.28" />
        <path d="M470 198 C640 160 820 240 990 192" stroke="#6f93e9" strokeWidth="12" opacity="0.42" />
        <path d="M240 300 C410 272 560 328 740 298" stroke="#7a9ae8" strokeWidth="10" opacity="0.45" />
        <path d="M760 284 C940 258 1110 332 1290 290" stroke="#9bb7ff" strokeWidth="11" opacity="0.34" />
        <path d="M120 404 C340 370 540 430 790 394" stroke="#6f93e9" strokeWidth="9" opacity="0.34" />
        <path d="M850 392 C1050 360 1240 414 1390 386" stroke="#8fb0ff" strokeWidth="8" opacity="0.26" />
        <path d="M160 456 C320 432 470 476 640 454" stroke="#a8c4ff" strokeWidth="10" opacity="0.18" />
      </g>
    </svg>
  )
}

function BoatSvg() {
  return (
    <svg className="sunsetLayers__boatSvg" viewBox="0 0 80 70" aria-hidden="true">
      <path d="M8 52 L72 52 L68 62 L12 62 Z" fill="#050608" />
      <path d="M40 8 L58 52 L22 52 Z" fill="#050608" />
      <path d="M40 18 L52 48 L28 48 Z" fill="#0c1018" opacity="0.9" />
    </svg>
  )
}

export default function SunsetLayeredScene({ scrollYProgress, onScrollProgress }) {
  const reduceMotion = useReducedMotion()
  const [scrollP, setScrollP] = useState(0)
  const [sunGlow, setSunGlow] = useState(0.55)

  const progress = useTransform(scrollYProgress, [0, 1], [0, 1])

  useMotionValueEvent(progress, 'change', (v) => {
    setScrollP(v)
    onScrollProgress?.(v)
  })

  const sunY = useTransform(progress, [0, 1], reduceMotion ? [0, 0] : [0, 220])
  const sunOpacity = useTransform(progress, [0, 0.55, 0.92], reduceMotion ? [1, 1, 1] : [1, 0.95, 0])
  const sunGlowOpacity = useTransform(progress, [0, 0.5, 0.9], reduceMotion ? [0.5, 0.5, 0.5] : [0.55, 0.35, 0])
  const sunScale = useTransform(progress, [0, 1], reduceMotion ? [1, 1] : [1, 0.92])

  useMotionValueEvent(sunGlowOpacity, 'change', setSunGlow)

  const cloudY = useTransform(progress, [0, 1], reduceMotion ? [0, 0] : [0, -28])
  const oceanY = useTransform(progress, [0, 1], reduceMotion ? [0, 0] : [0, 18])
  const boatY = useTransform(progress, [0, 1], reduceMotion ? [0, 0] : [0, 22])

  const shaderAnimate = !reduceMotion

  return (
    <div className="sunsetLayers sunsetLayers--painterly" aria-hidden="true">
      <div className="sunsetLayers__sky">
        <PainterlySkyShader scrollProgress={scrollP} animate={shaderAnimate} />
      </div>

      <motion.div className="sunsetLayers__clouds" style={{ y: cloudY }}>
        <CloudsSvg />
      </motion.div>

      <motion.div
        className="sunsetLayers__sun"
        style={{
          y: sunY,
          opacity: sunOpacity,
          scale: sunScale,
        }}
      >
        <PainterlySunShader glowOpacity={sunGlow} animate={shaderAnimate} />
      </motion.div>

      <motion.div className="sunsetLayers__ocean" style={{ y: oceanY }}>
        <OceanSvg />
      </motion.div>

      <motion.div className="sunsetLayers__boat" style={{ y: boatY }}>
        <BoatSvg />
      </motion.div>

      <PainterlyGrainOverlay animate={shaderAnimate} />
    </div>
  )
}

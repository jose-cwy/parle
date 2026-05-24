import { motion, useTransform } from 'framer-motion'

/**
 * Cozy bedroom illustration with parallax depth layers and interactive door.
 *
 * Props:
 *   scrollProgress  — MotionValue 0→1 from parent useScroll (optional)
 *   doorOpen        — boolean, drives door swing animation
 *   onDoorHover     — callback when door area hovered
 *   onDoorClick     — callback when door area clicked
 *   className       — extra class on the wrapper div
 */

const fairyLights = [
  { cx: 88, cy: 72, delay: 0 },
  { cx: 148, cy: 58, delay: 0.35 },
  { cx: 208, cy: 68, delay: 0.7 },
  { cx: 268, cy: 52, delay: 0.15 },
  { cx: 328, cy: 62, delay: 0.5 },
]

export default function CozyRoomIllustration({
  scrollProgress = null,
  doorOpen = false,
  onDoorHover,
  onDoorClick,
  className = '',
}) {
  /* Parallax y offsets — bg barely moves, fg shifts most */
  const bgY = scrollProgress
    ? useTransform(scrollProgress, [0, 1], [0, -28])
    : null
  const midY = scrollProgress
    ? useTransform(scrollProgress, [0, 1], [0, -52])
    : null
  const fgY = scrollProgress
    ? useTransform(scrollProgress, [0, 1], [0, -90])
    : null

  return (
    <div
      className={`cozy-room-cinematic ${className}`}
      aria-hidden="true"
    >
      <svg
        className="cozy-room-svg"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          <linearGradient id="cr-wall-base" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9A6E58" />
            <stop offset="100%" stopColor="#6E4E3C" />
          </linearGradient>
          <linearGradient id="cr-floor" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#8B6848" />
            <stop offset="100%" stopColor="#4A3428" />
          </linearGradient>
          <linearGradient id="cr-door-wood" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7A5238" />
            <stop offset="50%" stopColor="#6B4630" />
            <stop offset="100%" stopColor="#5A3A28" />
          </linearGradient>
          <linearGradient id="cr-hall-dark" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1a1410" />
            <stop offset="100%" stopColor="#0d0a08" />
          </linearGradient>
          <linearGradient id="cr-hall-warm" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#ffb060" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#e87830" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#c05020" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="cr-light-wash" x1="100%" y1="30%" x2="0%" y2="80%">
            <stop offset="0%" stopColor="rgba(255,210,150,0.42)" />
            <stop offset="55%" stopColor="rgba(255,180,100,0.12)" />
            <stop offset="100%" stopColor="rgba(255,160,80,0)" />
          </linearGradient>
          <pattern id="cr-plank" width="72" height="14" patternUnits="userSpaceOnUse">
            <rect width="72" height="14" fill="#6B4E38" />
            <line x1="0" y1="13" x2="72" y2="13" stroke="#3D2A22" strokeWidth="1" opacity="0.45" />
          </pattern>
          <filter id="door-glow">
            <feGaussianBlur stdDeviation="18" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="lamp-glow">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ── BG LAYER: wall, tiles, light wash ── */}
        <motion.g style={bgY ? { y: bgY } : {}}>
          <rect x="0" y="0" width="800" height="400" fill="url(#cr-wall-base)" />
          {[
            [24, 24, 118, 88, '#A87860'],
            [148, 18, 96, 72, '#7A5848'],
            [252, 32, 108, 76, '#B88868'],
            [368, 20, 88, 64, '#8B6450'],
            [464, 36, 102, 80, '#9A7058'],
            [576, 16, 92, 68, '#6E5040'],
            [680, 28, 96, 84, '#A07058'],
            [24, 118, 88, 72, '#7A5A48'],
            [120, 108, 104, 86, '#9A6858'],
            [580, 96, 110, 78, '#8B6048'],
            [688, 118, 88, 68, '#705040'],
          ].map(([x, y, w, h, fill], i) => (
            <rect
              key={`tile-${i}`}
              x={x} y={y} width={w} height={h} rx="3"
              fill={fill} stroke="#3D2A22" strokeWidth="2" opacity="0.92"
            />
          ))}
          <rect x="0" y="0" width="800" height="400" fill="url(#cr-light-wash)" />

          {/* Wall posters */}
          <g transform="translate(548, 56) rotate(-4)">
            <rect x="0" y="0" width="68" height="90" rx="2" fill="#E8DCC8" stroke="#3D2A22" strokeWidth="2" />
            <ellipse cx="34" cy="38" rx="16" ry="20" fill="#6B8A62" opacity="0.7" />
            <rect x="18" y="62" width="32" height="8" rx="2" fill="#C07850" opacity="0.6" />
          </g>
          <g transform="translate(620, 72) rotate(7)">
            <rect x="0" y="0" width="58" height="76" rx="2" fill="#D8C8B0" stroke="#3D2A22" strokeWidth="2" />
            <path d="M12,18 L46,18 L29,52 Z" fill="none" stroke="#7A5A48" strokeWidth="2" />
          </g>
        </motion.g>

        {/* ── FLOOR LAYER ── */}
        <motion.g style={bgY ? { y: bgY } : {}}>
          <path d="M0,400 Q400,388 800,400 L800,600 L0,600 Z" fill="url(#cr-floor)" stroke="#3D2A22" strokeWidth="2.5" />
          <rect x="0" y="400" width="800" height="200" fill="url(#cr-plank)" opacity="0.88" />
        </motion.g>

        {/* ── MID LAYER: furniture ── */}
        <motion.g style={midY ? { y: midY } : {}}>
          {/* Bookshelf + guitar — left */}
          <g transform="translate(36, 88)">
            <rect x="0" y="0" width="10" height="248" fill="#3D2A22" />
            <rect x="0" y="0" width="118" height="10" fill="#4A3428" />
            <rect x="0" y="78" width="118" height="10" fill="#4A3428" />
            <rect x="0" y="156" width="118" height="10" fill="#4A3428" />
            <rect x="0" y="234" width="118" height="10" fill="#4A3428" />
            {[
              [12, 12, 14, 62, '#8B5A62'], [30, 18, 12, 56, '#6B7B4C'],
              [46, 8, 16, 66, '#C07850'], [66, 14, 11, 60, '#7A9080'],
              [82, 10, 14, 64, '#A87868'], [14, 88, 15, 62, '#5A6B72'],
              [34, 92, 11, 58, '#D4A056'], [50, 84, 16, 66, '#8B7264'],
              [72, 90, 12, 60, '#6B7B4C'], [12, 166, 14, 62, '#C97B68'],
              [32, 170, 12, 58, '#7A5848'], [50, 162, 16, 66, '#5A7A52'],
            ].map(([x, y, w, h, fill], i) => (
              <rect key={`book-${i}`} x={x} y={y} width={w} height={h} rx="1" fill={fill} stroke="#3D2A22" strokeWidth="1" />
            ))}
          </g>

          {/* Guitar on stand */}
          <g transform="translate(168, 200)">
            <line x1="28" y1="168" x2="28" y2="220" stroke="#4A3428" strokeWidth="4" strokeLinecap="round" />
            <line x1="12" y1="220" x2="44" y2="220" stroke="#4A3428" strokeWidth="3" strokeLinecap="round" />
            <rect x="22" y="0" width="12" height="100" rx="4" fill="#6B4A32" stroke="#3D2A22" strokeWidth="1.5" />
            <rect x="14" y="-8" width="28" height="14" rx="4" fill="#523422" stroke="#3D2A22" strokeWidth="1.5" />
            <ellipse cx="28" cy="118" rx="38" ry="48" fill="#D4A060" stroke="#A06030" strokeWidth="2.5" />
            <ellipse cx="28" cy="118" rx="10" ry="10" fill="#5A3820" />
            <line x1="28" y1="8" x2="28" y2="108" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
          </g>

          {/* Music stand */}
          <g transform="translate(148, 340)">
            <line x1="20" y1="48" x2="20" y2="0" stroke="#4A3428" strokeWidth="3" strokeLinecap="round" />
            <path d="M0,0 L40,0 L36,28 L4,28 Z" fill="#E8DCC8" stroke="#3D2A22" strokeWidth="2" />
            <line x1="8" y1="10" x2="32" y2="10" stroke="#C4A888" strokeWidth="1" />
            <line x1="8" y1="18" x2="28" y2="18" stroke="#C4A888" strokeWidth="1" />
          </g>

          {/* Trunk + boombox — right */}
          <g transform="translate(598, 268)">
            <rect x="0" y="48" width="148" height="88" rx="8" fill="#5A7A52" stroke="#3D5248" strokeWidth="2.5" />
            <rect x="6" y="54" width="136" height="76" rx="6" fill="#6B8A62" stroke="#4A6A52" strokeWidth="1.5" />
            <rect x="58" y="78" width="32" height="18" rx="3" fill="#4A5A42" stroke="#3D2A22" strokeWidth="1.5" />
            <rect x="0" y="40" width="148" height="14" rx="4" fill="#4A6A48" stroke="#3D5248" strokeWidth="2" />
            <line x1="8" y1="48" x2="8" y2="136" stroke="#C4A060" strokeWidth="2" />
            <line x1="140" y1="48" x2="140" y2="136" stroke="#C4A060" strokeWidth="2" />
            <path d="M100,20 Q130,8 160,28 L168,52 Q140,48 108,42 Z" fill="#FFF4E8" stroke="#D4C4B0" strokeWidth="1.5" opacity="0.95" />
            <g transform="translate(24, -8)">
              <rect x="0" y="0" width="100" height="52" rx="6" fill="#8B7264" stroke="#3D2A22" strokeWidth="2" />
              <circle cx="28" cy="26" r="16" fill="#4A3428" stroke="#2D2318" strokeWidth="2" />
              <circle cx="72" cy="26" r="16" fill="#4A3428" stroke="#2D2318" strokeWidth="2" />
              <circle cx="28" cy="26" r="8" fill="#6B5048" />
              <circle cx="72" cy="26" r="8" fill="#6B5048" />
              <rect x="38" y="14" width="24" height="10" rx="2" fill="#3D2A22" />
              <line x1="50" y1="-12" x2="50" y2="0" stroke="#4A3428" strokeWidth="2" />
              <line x1="62" y1="-16" x2="62" y2="0" stroke="#4A3428" strokeWidth="2" />
            </g>
            <rect x="-18" y="72" width="14" height="36" rx="4" fill="#B85A48" stroke="#3D2A22" strokeWidth="1.5" />
          </g>

          {/* Candle sconce — right wall */}
          <g transform="translate(718, 140)">
            <rect x="0" y="0" width="8" height="24" fill="#5A4838" />
            <path d="M-6,24 Q4,48 14,24" fill="#FFF4E8" stroke="#3D2A22" strokeWidth="1.5" />
            <motion.ellipse
              cx="4" cy="20" rx="22" ry="28"
              fill="rgba(255,200,120,0.35)"
              filter="url(#lamp-glow)"
              animate={{ opacity: [0.4, 0.85, 0.45], rx: [18, 26, 19], ry: [24, 32, 25] }}
              transition={{ duration: 3.8, repeat: Infinity, ease: [0.22, 1, 0.36, 1] }}
            />
            <rect x="2" y="8" width="4" height="14" rx="1" fill="#FFF9F0" opacity="0.9" />
            {/* Candle flame */}
            <motion.path
              d="M4,8 C4,8 8,4 6,0 C4,-4 0,-2 2,2 C3,4 2,6 4,8 Z"
              fill="#FFD070"
              animate={{ scaleY: [1, 1.3, 0.9, 1.1, 1], scaleX: [1, 0.8, 1.1, 0.9, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{ transformOrigin: '4px 8px' }}
            />
          </g>

          {/* Teal fairy light string */}
          <path
            d="M48,48 Q120,18 200,58 T380,42"
            fill="none" stroke="#3D4A48" strokeWidth="2.2" strokeLinecap="round"
          />
          {fairyLights.map((light, i) => (
            <motion.g key={`light-${i}`}>
              <motion.circle
                cx={light.cx} cy={light.cy} r={6.5}
                fill="#4A8A82" stroke="#2D4848" strokeWidth="1.5"
                animate={{ opacity: [0.5, 1, 0.55], scale: [0.9, 1.15, 0.92] }}
                transition={{ duration: 2.8 + (i % 3) * 0.5, repeat: Infinity, ease: [0.22, 1, 0.36, 1], delay: light.delay }}
              />
              <motion.circle
                cx={light.cx} cy={light.cy} r={16}
                fill="rgba(74,138,130,0.4)"
                animate={{ opacity: [0.2, 0.6, 0.25] }}
                transition={{ duration: 2.8 + (i % 3) * 0.5, repeat: Infinity, ease: [0.22, 1, 0.36, 1], delay: light.delay }}
              />
            </motion.g>
          ))}
        </motion.g>

        {/* ── DOOR LAYER (interactive) ── */}
        <motion.g style={midY ? { y: midY } : {}}>
          <g transform="translate(268, 52)">
            {/* Door frame / arch */}
            <path d="M0,348 L0,80 Q132,0 264,80 L264,348 Z" fill="#4A3428" stroke="#2D2318" strokeWidth="3" />

            {/* Hallway — dark normally, warm when door opens */}
            <path d="M18,330 L18,92 Q132,22 246,92 L246,330 Z" fill="url(#cr-hall-dark)" />
            <motion.path
              d="M18,330 L18,92 Q132,22 246,92 L246,330 Z"
              fill="url(#cr-hall-warm)"
              animate={{ opacity: doorOpen ? 0.92 : 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
            {/* Warm light spill on floor from open door */}
            <motion.ellipse
              cx="132" cy="340" rx="80" ry="20"
              fill="rgba(255,180,80,0.35)"
              animate={{ opacity: doorOpen ? 0.9 : 0, rx: doorOpen ? 90 : 40 }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            />

            {/* Door panel — animated open/close */}
            <motion.g
              style={{ transformOrigin: '228px 174px' }}
              animate={{ rotateY: doorOpen ? -55 : 0 }}
              transition={{ type: 'spring', stiffness: 55, damping: 18, mass: 1.4 }}
            >
              <path
                d="M228,330 L228,88 Q336,18 444,88 L444,330 Z"
                fill="url(#cr-door-wood)" stroke="#3D2A22" strokeWidth="2.5"
              />
              {[24, 52, 80, 108, 136, 164, 192].map((y) => (
                <line key={`band-${y}`} x1="236" y1={y} x2="436" y2={y} stroke="#4A3020" strokeWidth="3" strokeLinecap="round" />
              ))}
              {[256, 286, 316, 346, 376, 406].map((x) => (
                <line key={`plank-${x}`} x1={x} y1="88" x2={x} y2="330" stroke="#5A3828" strokeWidth="1.2" opacity="0.5" />
              ))}
              {/* Posters */}
              <g transform="translate(276, 120) rotate(-5)">
                <rect x="0" y="0" width="56" height="72" rx="2" fill="#E8D4BC" stroke="#3D2A22" strokeWidth="1.8" />
                <circle cx="28" cy="32" r="14" fill="none" stroke="#6B8A62" strokeWidth="2" />
                <path d="M14,52 L42,52" stroke="#C07850" strokeWidth="2" />
              </g>
              <g transform="translate(346, 108) rotate(6)">
                <rect x="0" y="0" width="48" height="64" rx="2" fill="#D4C4A8" stroke="#3D2A22" strokeWidth="1.8" />
                <path d="M8,20 L40,20 L24,48 Z" fill="none" stroke="#8B5A62" strokeWidth="2" />
              </g>
              <rect x="384" y="168" width="32" height="32" rx="1" fill="#FFE8A0" stroke="#C4A860" strokeWidth="1.2" transform="rotate(4 400 184)" />
            </motion.g>

            {/* Invisible hit zone on door for hover/click */}
            <rect
              x="18" y="22" width="228" height="308"
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={onDoorHover}
              onClick={onDoorClick}
            />
          </g>
        </motion.g>

        {/* ── FG LAYER: rug, floor clutter ── */}
        <motion.g style={fgY ? { y: fgY } : {}}>
          {/* Sage circular rug with fringe */}
          <ellipse cx="400" cy="498" rx="148" ry="54" fill="#5A7A68" stroke="#3D5248" strokeWidth="2.5" />
          <ellipse cx="400" cy="498" rx="108" ry="38" fill="none" stroke="#7A9A88" strokeWidth="2" opacity="0.55" />
          <ellipse cx="400" cy="498" rx="62" ry="22" fill="#6B8A78" opacity="0.45" />
          {[...Array(24)].map((_, i) => {
            const angle = (i / 24) * Math.PI * 2
            const cx = 400 + Math.cos(angle) * 148
            const cy = 498 + Math.sin(angle) * 54
            return (
              <line key={`fringe-${i}`} x1={cx} y1={cy}
                x2={cx + Math.cos(angle) * 10} y2={cy + Math.sin(angle) * 6}
                stroke="#E8DCC8" strokeWidth="2.5" strokeLinecap="round" />
            )
          })}

          {/* Boots */}
          <g transform="translate(640, 468)">
            <path d="M0,28 Q0,0 16,0 L28,0 Q40,0 40,28 L38,36 Q20,40 0,36 Z" fill="#6B4A38" stroke="#3D2A22" strokeWidth="2" />
            <path d="M48,28 Q48,0 64,0 L76,0 Q88,0 88,28 L86,36 Q68,40 48,36 Z" fill="#5A4030" stroke="#3D2A22" strokeWidth="2" />
          </g>

          {/* Floor clutter */}
          <g transform="translate(280, 468)">
            <ellipse cx="0" cy="0" rx="14" ry="10" fill="#E8DCC8" stroke="#3D2A22" strokeWidth="1.5" />
            <path d="M-8,-4 Q0,-12 8,-4" fill="none" stroke="#C4A888" strokeWidth="1" />
          </g>
          <g transform="translate(340, 478)">
            <ellipse cx="0" cy="0" rx="12" ry="9" fill="#F0E4D0" stroke="#3D2A22" strokeWidth="1.5" />
          </g>
          <g transform="translate(500, 472)">
            <rect x="0" y="0" width="36" height="48" rx="6" fill="#9A9088" stroke="#3D2A22" strokeWidth="2" />
            <rect x="6" y="6" width="24" height="22" rx="2" fill="#6B8A62" stroke="#3D5248" strokeWidth="1.5" />
            <circle cx="12" cy="38" r="4" fill="#4A4848" stroke="#2D2A28" strokeWidth="1" />
            <circle cx="24" cy="38" r="4" fill="#4A4848" stroke="#2D2A28" strokeWidth="1" />
          </g>
          <line x1="560" y1="490" x2="560" y2="458" stroke="#C07850" strokeWidth="3" strokeLinecap="round" />
          <rect x="572" y="462" width="40" height="32" rx="2" fill="#FFF4E8" stroke="#3D2A22" strokeWidth="1.5" transform="rotate(6 592 478)" />
        </motion.g>

        {/* ── OVERALL WARM LIGHT WASH (on top of everything) ── */}
        <motion.rect
          x="0" y="0" width="800" height="600"
          fill="rgba(255,200,120,0.06)"
          animate={{ opacity: [0.06, 0.14, 0.07] }}
          transition={{ duration: 7.5, repeat: Infinity, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>

      {/* Grain + vignette overlays */}
      <div className="cozy-room-grain" />
      <div className="cozy-room-vignette" />
    </div>
  )
}

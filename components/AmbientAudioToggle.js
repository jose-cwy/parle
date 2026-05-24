import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

/**
 * Fixed ambient audio toggle — bottom-right corner.
 * Audio only starts on explicit user interaction (no autoplay).
 */
export default function AmbientAudioToggle() {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const audio = new Audio()
    audio.loop = true
    audio.volume = 0.28
    /* Royalty-free rain + fireplace from freesound / pixabay CDN */
    audio.src = '/ambient.mp3'
    audio.addEventListener('canplaythrough', () => setLoaded(true))
    audioRef.current = audio

    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {})
    }
  }

  return (
    <motion.button
      onClick={toggle}
      title={playing ? 'Mute ambient sounds' : 'Play ambient sounds'}
      aria-label={playing ? 'Mute ambient sounds' : 'Play ambient sounds'}
      className="ambient-toggle"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.92 }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 2.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        {playing ? (
          /* Speaker with waves */
          <>
            <path d="M3,7 L7,7 L11,3 L11,17 L7,13 L3,13 Z" fill="currentColor" />
            <path d="M13,6 C14.5,7.5 14.5,12.5 13,14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            <path d="M15,4 C17.5,6.5 17.5,13.5 15,16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </>
        ) : (
          /* Speaker muted */
          <>
            <path d="M3,7 L7,7 L11,3 L11,17 L7,13 L3,13 Z" fill="currentColor" />
            <line x1="14" y1="7" x2="18" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="18" y1="7" x2="14" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
      </svg>
      <span className="ambient-toggle-label">
        {playing ? 'Sounds on' : 'Ambient'}
      </span>
    </motion.button>
  )
}

import { motion } from 'framer-motion'
import { stagger } from '../../lib/motion'

const PREVIEWS = [
  {
    id: 'chat',
    label: 'Chat',
    description: 'A steady listener when you need to talk.',
    mock: (
      <>
        <div className="landing-preview-card__bubble">I do not know where to start.</div>
        <div className="landing-preview-card__chips">
          <span className="landing-preview-card__chip">I miss them</span>
          <span className="landing-preview-card__chip">I feel empty</span>
          <span className="landing-preview-card__chip">Help me sort this out</span>
        </div>
      </>
    ),
  },
  {
    id: 'diary',
    label: 'Diary',
    description: 'Private entries on the days that hurt.',
    mock: (
      <p className="landing-preview-card__diary-line">
        Tonight I finally wrote what I could not say out loud…
      </p>
    ),
  },
  {
    id: 'letter',
    label: 'Letter',
    description: 'Write to your future self, then seal it.',
    mock: (
      <span className="landing-preview-card__seal">
        <span aria-hidden="true">♥</span> Seal letter
      </span>
    ),
  },
]

export default function ToolPreviewCards() {
  return (
    <motion.div
      className="landing-previews"
      variants={stagger.container}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, margin: '-40px' }}
    >
      {PREVIEWS.map((p) => (
        <motion.article
          key={p.id}
          className="landing-preview-card"
          variants={stagger.item}
        >
          <p className="landing-preview-card__label">{p.label}</p>
          <div className="landing-preview-card__body">
            <p style={{ margin: '0 0 0.5rem', color: 'var(--landing-text-muted)', fontSize: '0.85rem' }}>
              {p.description}
            </p>
            <div className="landing-preview-card__mock">{p.mock}</div>
          </div>
        </motion.article>
      ))}
    </motion.div>
  )
}

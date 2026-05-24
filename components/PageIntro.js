import { motion } from 'framer-motion'
import Reveal from './Reveal'
import { hoverGlow, hoverLift } from '../lib/motion'

export default function PageIntro({ eyebrow, title, description, action }){
  return (
    <Reveal>
      <div className="page-intro md:grid-cols-[0.9fr_1.1fr]">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2 className="mt-2 section-title">{title}</h2>
        </div>
        <div className="flex flex-col gap-4 md:items-end md:justify-between">
          {description ? <p className="subtle text-base leading-7 md:text-right">{description}</p> : null}
          {action ? (
            <motion.div {...hoverLift}>
              {action}
            </motion.div>
          ) : null}
        </div>
      </div>
    </Reveal>
  )
}

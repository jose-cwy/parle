import { motion } from 'framer-motion'
import Reveal from './Reveal'
import { hoverLift } from '../lib/motion'

export default function PageIntro({ eyebrow, title, description, action }){
  return (
    <Reveal>
      <header className="hs-app-header app-page-intro">
        <div className="hs-app-header__main">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          {title ? <h1 className="hs-app-header__title">{title}</h1> : null}
          {description ? <p className="hs-app-header__desc">{description}</p> : null}
        </div>
        {action ? (
          <motion.div className="hs-app-header__action" {...hoverLift}>
            {action}
          </motion.div>
        ) : null}
      </header>
    </Reveal>
  )
}

import { motion, useReducedMotion } from 'framer-motion'
import { sectionReveal } from '../../lib/motion'

const LETTERS = [
  {
    time: '2:14am',
    text: 'I thought I was okay, and then it hit me all at once. Being able to just write it down helped me breathe.',
  },
  {
    time: '11:03pm',
    text: 'The chat didn’t fix me. It just stayed with me long enough for the night to pass.',
  },
  {
    time: '1:28am',
    text: 'I sealed a letter to my future self. It was the first kind thing I’d done for me in weeks.',
  },
  {
    time: '9:47pm',
    text: 'Saving a quote felt small — but it gave me one sentence to hold onto.',
  },
]

export default function AfterglowLettersTestimonials() {
  const reduceMotion = useReducedMotion()
  const motionProps = reduceMotion
    ? {}
    : {
        initial: 'hidden',
        whileInView: 'visible',
        viewport: { once: true, margin: '-80px' },
        variants: sectionReveal,
      }

  return (
    <motion.section
      className="landing-page__section landing-page__section--letters"
      aria-labelledby="landing-letters-title"
      {...motionProps}
    >
      <h2 id="landing-letters-title" className="landing-page__section-title landing-page__section-title--sunset">
        Late-night notes
      </h2>
      <p className="landing-page__section-lead landing-page__section-lead--sunset">
        Quiet excerpts from people who needed somewhere to put it.
      </p>

      <div className="afterglowLetters" role="list">
        {LETTERS.map((l) => (
          <article key={l.time} className="afterglowLetter" role="listitem">
            <div className="afterglowLetter__top">
              <span className="afterglowLetter__dot" aria-hidden="true" />
              <span className="afterglowLetter__time">{l.time}</span>
            </div>
            <p className="afterglowLetter__text">{l.text}</p>
          </article>
        ))}
      </div>
    </motion.section>
  )
}


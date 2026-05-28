import Link from 'next/link'
import { motion } from 'framer-motion'

const REMINDERS = [
  'You do not have to be okay today.',
  'One honest sentence is enough.',
  'Rest is not giving up.',
  'Your feelings are allowed to be messy.',
  'You are allowed to take up space here.',
]

function displayName(user) {
  if (!user?.email) return 'friend'
  return user.email.split('@')[0]
}

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
}

export default function DashboardHome({ user, firstTime = false, hasDiary = false, hasLetterDraft = false }) {
  const quickActions = [
    { href: '/letter-to-yourself', label: 'Write a letter', desc: 'Say what you never got to say.' },
    { href: '/diary', label: 'Open diary', desc: 'Capture what today felt like.' },
    { href: '/quotes', label: 'Browse quotes', desc: 'Find words that meet you gently.' },
  ]

  const continueSuggestion = (() => {
    if (hasLetterDraft) return { href: '/letter-to-yourself', title: 'Continue your letter', body: 'Finish the sentence you stopped on. Then seal it when you are ready.' }
    if (hasDiary) return { href: '/diary', title: 'Open today’s page', body: 'One honest paragraph is enough for tonight.' }
    return { href: '/letter-to-yourself', title: 'Start a closure letter', body: 'Write what you never got to say. Keep it private. Seal it when it feels done.' }
  })()

  const reminder = REMINDERS[new Date().getDate() % REMINDERS.length]

  return (
    <div className="dashboard-home">
      <motion.p className="dashboard-home__eyebrow" {...cardMotion}>
        Your private space
      </motion.p>
      <motion.h1 className="dashboard-home__title" {...cardMotion} transition={{ ...cardMotion.transition, delay: 0.04 }}>
        Welcome back, {displayName(user)}.
      </motion.h1>
      <motion.p className="dashboard-home__lead" {...cardMotion} transition={{ ...cardMotion.transition, delay: 0.08 }}>
        When it is loud inside your head, you do not need a performance. You need somewhere safe to put it.
      </motion.p>

      <motion.div className="dashboard-home__primary" {...cardMotion} transition={{ ...cardMotion.transition, delay: 0.12 }}>
        <Link href="/chat" className="dashboard-home__cta-primary">
          Talk it through
        </Link>
        <p className="dashboard-home__cta-hint">Heartstrings listens without fixing you.</p>
      </motion.div>

      <motion.ul
        className="dashboard-home__actions"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.06, delayChildren: 0.16 } },
        }}
      >
        {quickActions.map((tool) => (
          <motion.li
            key={tool.href}
            variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
          >
            <Link href={tool.href} className="dashboard-home__action-card">
              <p className="dashboard-home__action-label">{tool.label}</p>
              <p className="dashboard-home__action-desc">{tool.desc}</p>
            </Link>
          </motion.li>
        ))}
      </motion.ul>

      <motion.div className="dashboard-home__reminder" {...cardMotion} transition={{ ...cardMotion.transition, delay: 0.28 }}>
        <p className="dashboard-home__continue-label">Today’s gentle reminder</p>
        <p>{reminder}</p>
      </motion.div>

      <motion.div className="dashboard-home__continue" {...cardMotion} transition={{ ...cardMotion.transition, delay: 0.32 }}>
        <p className="dashboard-home__continue-label">Continue</p>
        <div className="dashboard-home__continue-card">
          <p className="dashboard-home__continue-title">{continueSuggestion.title}</p>
          <p className="dashboard-home__continue-body">{continueSuggestion.body}</p>
          <Link href={continueSuggestion.href} className="dashboard-home__continue-link">
            Go →
          </Link>
        </div>
      </motion.div>

      {firstTime && (
        <motion.div className="dashboard-home__nudge" {...cardMotion} transition={{ ...cardMotion.transition, delay: 0.36 }}>
          <p className="dashboard-home__nudge-title">First time here?</p>
          <p className="dashboard-home__nudge-body">
            If words feel stuck, try writing a letter to future-you. Seal it until you are ready.
          </p>
          <Link href="/letter-to-yourself" className="dashboard-home__nudge-link">
            Start your letter
          </Link>
        </motion.div>
      )}

      <p className="dashboard-home__privacy">No feed. No audience. Just you.</p>
    </div>
  )
}

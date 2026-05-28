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

const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
}

export default function DashboardHome({ user, firstTime = false, hasDiary = false, hasLetterDraft = false }) {
  const quickActions = [
    { href: '/chat', label: 'Open chat', desc: 'Talk it through with Heartstrings.' },
    { href: '/diary', label: 'Open diary', desc: 'Capture what today felt like.' },
    { href: '/quotes', label: 'Browse quotes', desc: 'Words that meet you gently.' },
  ]

  const continueSuggestion = (() => {
    if (hasLetterDraft) return { href: '/letter-to-yourself', title: 'Continue your letter', body: 'Finish the sentence you stopped on. Seal it when you are ready.' }
    if (hasDiary) return { href: '/diary', title: 'Open today’s page', body: 'One honest paragraph is enough for tonight.' }
    return { href: '/letter-to-yourself', title: 'Write a letter', body: 'Say what you never got to say. Keep it private until you are ready.' }
  })()

  const reminder = REMINDERS[new Date().getDate() % REMINDERS.length]

  return (
    <div className="dashboard-home">
      <motion.section className="dashboard-home__welcome" {...fade}>
        <p className="dashboard-home__eyebrow">Your private space</p>
        <h1 className="dashboard-home__title">Welcome back, {displayName(user)}.</h1>
        <p className="dashboard-home__lead">
          When it is loud inside your head, you do not need a performance. You need somewhere safe to put it.
        </p>
      </motion.section>

      <motion.section className="dashboard-home__primary" {...fade} transition={{ ...fade.transition, delay: 0.05 }}>
        <Link href="/chat" className="dashboard-home__cta-primary">
          Talk it through
        </Link>
        <p className="dashboard-home__cta-hint">Heartstrings listens without fixing you.</p>
      </motion.section>

      <motion.ul
        className="dashboard-home__actions"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
        }}
      >
        {quickActions.map((tool) => (
          <motion.li key={tool.href} variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
            <Link href={tool.href} className="dashboard-home__action-card">
              <p className="dashboard-home__action-label">{tool.label}</p>
              <p className="dashboard-home__action-desc">{tool.desc}</p>
            </Link>
          </motion.li>
        ))}
      </motion.ul>

      <motion.section className="dashboard-home__reminder" {...fade} transition={{ ...fade.transition, delay: 0.2 }}>
        <p className="dashboard-home__continue-label">Today’s gentle reminder</p>
        <p>{reminder}</p>
      </motion.section>

      <motion.section className="dashboard-home__continue" {...fade} transition={{ ...fade.transition, delay: 0.24 }}>
        <p className="dashboard-home__continue-label">Continue</p>
        <div className="dashboard-home__continue-card">
          <p className="dashboard-home__continue-title">{continueSuggestion.title}</p>
          <p className="dashboard-home__continue-body">{continueSuggestion.body}</p>
          <Link href={continueSuggestion.href} className="dashboard-home__continue-link">
            Continue →
          </Link>
        </div>
      </motion.section>

      {firstTime && (
        <motion.section className="dashboard-home__nudge" {...fade} transition={{ ...fade.transition, delay: 0.28 }}>
          <p className="dashboard-home__continue-title">First time here?</p>
          <p className="dashboard-home__nudge-body">
            If words feel stuck, try writing a letter to future-you. Seal it until you are ready.
          </p>
          <Link href="/letter-to-yourself" className="dashboard-home__nudge-link">
            Start your letter
          </Link>
        </motion.section>
      )}

      <p className="dashboard-home__privacy">No feed. No audience. Just you.</p>
    </div>
  )
}

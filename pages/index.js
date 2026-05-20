import Link from 'next/link'
import { motion } from 'framer-motion'
import AnimatedCard from '../components/AnimatedCard'
import Reveal from '../components/Reveal'

const featureCards = [
  {
    title: 'Private Diary',
    description: 'Create deeply personal entries with a soft calendar, quick mood capture, and private storage.',
    accent: 'from-[#f4e7d6] to-[#e9d0ba]'
  },
  {
    title: 'AI Chat Companion',
    description: 'A calm, supportive chatbot with memory, safety filters, and a natural conversational rhythm.',
    accent: 'from-[#efe2d2] to-[#ddc3aa]'
  },
  {
    title: 'Quotes Book',
    description: 'Browse chaptered quotes by heartbreak, healing, self-love, reflection, and inspiration.',
    accent: 'from-[#f7efe3] to-[#e4cfb8]'
  },
]

const heroWords = ['Private', 'Calming', 'Animated', 'Supportive']
const supportStats = [
  { label: 'Gentle rituals', value: '03' },
  { label: 'Healing spaces', value: '04' },
  { label: 'Moments saved', value: '24/7' },
]

export default function Home(){
  return (
    <div className="relative space-y-14 pb-12">
      <div className="ambient-orb" style={{top:'-50px', left:'-40px'}} />
      <div className="ambient-orb orb-two" style={{top:'220px', right:'40px'}} />
      <div className="ambient-orb orb-three" style={{bottom:'40px', left:'30%'}} />
      <div className="ambient-ring" style={{ top: '8%', right: '8%' }} />
      <div className="ambient-ring ambient-ring-two" style={{ bottom: '12%', left: '10%' }} />

      <section className="hero-grid items-center">
        <div className="space-y-6">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="inline-flex items-center rounded-full border border-[rgba(140,97,71,0.14)] bg-white/60 px-4 py-2 text-sm text-[#7a6756] shadow-sm"
          >
            <span className="status-dot mr-2" />
            Heartbreak support, designed to feel human.
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
            className="section-title max-w-xl text-[#241e1a]"
          >
            A private, calming space for healing after love hurts.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.14 }}
            className="max-w-2xl text-base leading-7 subtle"
          >
            Heartstrings Club blends a private diary, an emotionally aware AI companion, and a chaptered quotes library into a single gentle experience.
            The entire journey is tuned for softness, clarity, and emotional safety.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-wrap gap-3"
          >
            <Link href="/register" className="soft-button bg-[#b88957] text-white border-transparent hover:opacity-95">
              Start your space
            </Link>
            <Link href="/quotes" className="soft-button">
              Explore quotes
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.26 }}
            className="flex flex-wrap gap-3"
          >
            {heroWords.map((word, index) => (
              <motion.div
                key={word}
                className="hero-chip"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, delay: index * 0.25, ease: 'easeInOut' }}
              >
                {word}
              </motion.div>
            ))}
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.32 }}
            className="grid max-w-2xl gap-3 sm:grid-cols-3"
          >
            {supportStats.map((item, index) => (
              <motion.div
                key={item.label}
                className="glass-panel stat-panel"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.36 + index * 0.06 }}
              >
                <div className="text-3xl font-semibold text-[#241e1a]">{item.value}</div>
                <div className="mt-2 text-sm subtle">{item.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <Reveal delay={0.08}>
          <AnimatedCard className="relative overflow-hidden p-0 hero-showcase" hover={false}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-[#d8b693]/40" />
            <div className="hero-showcase-grid" />
            <div className="relative p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-[#8c6147]">Today</p>
                  <p className="font-semibold">A soft place to land</p>
                </div>
                <div className="rounded-full bg-white/70 px-3 py-1 text-sm text-[#7a6756] shadow-sm">Streak 7</div>
              </div>
              <div className="relative overflow-hidden rounded-[24px] border border-white/60 bg-[rgba(255,255,255,0.66)] p-4">
                <motion.div
                  className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white/60 to-transparent"
                  animate={{ x: ['-120%', '260%'] }}
                  transition={{ duration: 4.2, repeat: Infinity, repeatDelay: 0.8, ease: 'easeInOut' }}
                />
                <div className="relative flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#8c6147]">Mood rhythm</p>
                    <p className="mt-2 text-sm">Steadier reflections, lighter evenings, more space to breathe.</p>
                  </div>
                  <div className="equalizer">
                    {[0, 1, 2, 3].map((bar) => (
                      <span key={bar} className="equalizer-bar" style={{ animationDelay: `${bar * 0.18}s` }} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="glass-panel bg-white/70">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8c6147]">Diary</p>
                  <p className="mt-2 text-sm">3 entries logged this week</p>
                </div>
                <div className="glass-panel bg-white/70">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8c6147]">Chat</p>
                  <p className="mt-2 text-sm">12 supportive conversations</p>
                </div>
              </div>
              <div className="glass-panel bg-white/70">
                <p className="text-xs uppercase tracking-[0.18em] text-[#8c6147]">Milestone</p>
                <p className="mt-2 text-sm">Healing badge unlocked: Gentle consistency</p>
              </div>
            </div>
          </AnimatedCard>
        </Reveal>
      </section>

      <Reveal>
        <section className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[#8c6147]">Designed with motion</p>
            <h2 className="section-title text-[#241e1a]">A softer interface that feels alive while staying calm.</h2>
          </div>
          <p className="subtle text-base leading-7">
            Instead of static blocks, the experience now layers floating light, staggered entrances, tactile hover depth, and smoother transitions between screens and content states.
          </p>
        </section>
      </Reveal>

      <section className="feature-grid">
        {featureCards.map((feature, index) => (
          <Reveal key={feature.title} delay={0.08 * index}>
            <AnimatedCard className={`h-full bg-gradient-to-br ${feature.accent}`}>
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[#8c6147]">0{index + 1}</p>
                <h3 className="text-xl font-semibold text-[#241e1a]">{feature.title}</h3>
                <p className="leading-6 text-[#5e4b3f]">{feature.description}</p>
              </div>
            </AnimatedCard>
          </Reveal>
        ))}
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          ['Daily reflection', 'Write what happened, what hurt, and what you need next.'],
          ['Safe support', 'Guided responses and helpline prompts when conversations need care.'],
          ['Progress made visible', 'Streaks, badges, and milestones that quietly celebrate consistency.'],
        ].map(([title, description], index) => (
          <Reveal key={title} delay={0.05 * index}>
            <div className="glass-panel h-full">
              <p className="text-sm uppercase tracking-[0.18em] text-[#8c6147]">{title}</p>
              <p className="mt-3 text-sm leading-6 subtle">{description}</p>
            </div>
          </Reveal>
        ))}
      </section>
    </div>
  )
}

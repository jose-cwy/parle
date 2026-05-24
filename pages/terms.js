import { useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import AnimatedCard from '../components/AnimatedCard'
import Reveal from '../components/Reveal'
import { SkeletonButton } from '../components/Skeleton'
import { termsSections } from '../data/termsContent'

export default function TermsPage(){
  const [hasReachedBottom, setHasReachedBottom] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const router = useRouter()

  const progressLabel = useMemo(() => (
    hasReachedBottom ? 'You can now accept the terms.' : 'Scroll to the bottom to unlock the accept button.'
  ), [hasReachedBottom])

  function handleScroll(event){
    const node = event.currentTarget
    const threshold = 24
    const isAtBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - threshold
    if(isAtBottom) setHasReachedBottom(true)
  }

  async function handleAccept(){
    if(!hasReachedBottom || accepting) return
    setAccepting(true)

    const res = await fetch('/api/auth/terms-accept', { method: 'POST' })
    if(res.ok){
      router.push('/register')
      return
    }

    setAccepting(false)
    alert('Unable to record your acceptance right now. Please try again.')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <Reveal>
        <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#8c6147]">Before signup</p>
            <h1 className="section-title text-[#241e1a]">Read the terms and conditions before creating your account.</h1>
            <p className="max-w-xl text-base leading-7 subtle">
              This standalone page is still available if you want to review the agreement outside the signup popup.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="glass-panel p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[#8c6147]">Account gate</p>
              <p className="mt-3 text-sm leading-7 subtle">The same content also appears as a blocking popup directly on the signup page before the form becomes interactive.</p>
            </div>
            <div className="glass-panel p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[#8c6147]">Responsive flow</p>
              <p className="mt-3 text-sm leading-7 subtle">The terms area is sized for mobile and desktop, with smooth scrolling and a locked action until the end is reached.</p>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.06}>
        <AnimatedCard className="overflow-hidden p-0" hover={false}>
          <div className="border-b border-[rgba(140,97,71,0.12)] bg-white/45 px-6 py-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#8c6147]">Terms and conditions</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#241e1a]">Heartstrings Club V1 Agreement</h2>
              </div>
              <div className={`rounded-full px-4 py-2 text-sm shadow-sm ${hasReachedBottom ? 'bg-[rgba(184,137,87,0.18)] text-[#5e4b3f]' : 'bg-white/75 text-[#7a6756]'}`}>
                {progressLabel}
              </div>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
            <div
              onScroll={handleScroll}
              className="terms-scroll-area max-h-[65vh] overflow-y-auto scroll-smooth border-b border-[rgba(140,97,71,0.08)] bg-[rgba(255,252,248,0.84)] px-6 py-6 lg:border-b-0 lg:border-r"
            >
              <div className="space-y-6">
                {termsSections.map((section, index) => (
                  <motion.section
                    key={section.title}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.35 }}
                    className="rounded-[24px] border border-[rgba(140,97,71,0.1)] bg-white/68 p-5 shadow-[0_12px_30px_rgba(40,28,18,0.05)]"
                  >
                    <h3 className="text-lg font-semibold text-[#241e1a]">{section.title}</h3>
                    <p className="mt-3 text-sm leading-7 subtle">{section.body}</p>
                  </motion.section>
                ))}
              </div>
            </div>

            <div className="flex flex-col justify-between gap-6 px-6 py-6">
              <div className="space-y-4">
                <div className="glass-panel p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8c6147]">Acceptance</p>
                  <p className="mt-3 text-sm leading-7 subtle">
                    Accepting sets a short-lived server cookie that unlocks signup and lets the backend verify that this step was completed first.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {accepting ? (
                  <SkeletonButton className="h-12 w-full" />
                ) : (
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={!hasReachedBottom}
                    className="soft-button w-full border-transparent bg-[#b88957] py-3 text-white disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    Accept and continue to signup
                  </button>
                )}
              </div>
            </div>
          </div>
        </AnimatedCard>
      </Reveal>
    </div>
  )
}

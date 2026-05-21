import { motion } from 'framer-motion'
import { termsSections } from '../data/termsContent'

export default function TermsGateModal({
  accepting,
  hasReachedBottom,
  onAccept,
  onScroll
}){
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,14,10,0.42)] px-4 py-8 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="terms-popup w-full max-w-[22rem] overflow-hidden rounded-[22px] border border-[rgba(140,97,71,0.12)] bg-white shadow-[0_24px_80px_rgba(40,28,18,0.2)] sm:max-w-[24rem]"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="px-6 pb-3 pt-6 text-center">
          <h2 className="text-[1.75rem] font-semibold text-[#241e1a]">Terms and Conditions</h2>
        </div>

        <div
          onScroll={onScroll}
          className="terms-popup-scroll mx-5 max-h-[18rem] overflow-y-auto rounded-[14px] border border-[rgba(140,97,71,0.1)] bg-[rgba(249,245,239,0.74)] px-4 py-4 text-sm leading-7 text-[#5e4b3f] sm:max-h-[19rem]"
        >
          <div className="space-y-5">
            {termsSections.map((section) => (
              <section key={section.title}>
                <h3 className="font-semibold text-[#241e1a]">{section.title}</h3>
                <p className="mt-2">{section.body}</p>
              </section>
            ))}
            <p className="rounded-[12px] bg-white/80 px-3 py-3 text-[#6b5b4b]">
              You have reached the bottom of the agreement. Accepting it unlocks the signup form.
            </p>
          </div>
        </div>

        <div className="px-5 pb-5 pt-4">
          <button
            type="button"
            onClick={onAccept}
            disabled={!hasReachedBottom || accepting}
            className="w-full rounded-[12px] bg-[#111111] px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {accepting ? 'Accepting...' : 'Accept'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

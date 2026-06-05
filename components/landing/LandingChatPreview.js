import { motion } from 'framer-motion'
import { Heart, MessageCircle } from 'lucide-react'

export default function LandingChatPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5, duration: 0.8 }}
      className="hidden lg:block"
      aria-hidden="true"
    >
      <div
        className="rounded-2xl p-6 max-w-md mx-auto"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          boxShadow: '0 25px 50px -12px rgba(45, 37, 32, 0.15)',
        }}
      >
        <div
          className="flex items-center gap-3 mb-6 pb-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(239, 68, 68, 0.1)' }}
          >
            <Heart className="w-5 h-5" style={{ color: 'var(--primary)' }} strokeWidth={1.8} />
          </div>
          <div>
            <p className="font-medium" style={{ color: 'var(--foreground)' }}>parlé</p>
            <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              <div className="lf-pulse-dot w-2 h-2 bg-green-500 rounded-full" />
              <span>Always here for you</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="flex gap-2"
          >
            <div
              className="rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%] text-sm"
              style={{ background: 'var(--muted)', color: 'var(--foreground)' }}
            >
              Hey there. I can tell you&apos;re going through something difficult. Want to talk about it?
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.3 }}
            className="flex gap-2 justify-end"
          >
            <div
              className="rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%] text-sm text-white"
              style={{ background: 'var(--primary)' }}
            >
              I just can&apos;t stop thinking about them...
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6 }}
            className="flex gap-2"
          >
            <div
              className="rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%] text-sm"
              style={{ background: 'var(--muted)', color: 'var(--foreground)' }}
            >
              That&apos;s completely normal. Missing someone doesn&apos;t follow a timeline. I&apos;m here to listen.
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.9 }}
          className="mt-6 pt-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div
            className="flex items-center gap-2 rounded-full px-4 py-3"
            style={{ background: 'var(--background)' }}
          >
            <MessageCircle className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} strokeWidth={1.8} />
            <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Share what&apos;s on your mind...
            </span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

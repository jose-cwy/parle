import { motion } from 'framer-motion'
import { spring } from '../lib/motion'

export function SkeletonBlock({ className = '', style, rounded = 'rounded-xl' }){
  return (
    <div
      className={`skeleton-block ${rounded} ${className}`}
      style={style}
      aria-hidden="true"
    />
  )
}

export function SkeletonText({ lines = 3, className = '' }){
  return (
    <div className={`space-y-2.5 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock
          key={i}
          className="h-3"
          style={{ width: i === lines - 1 ? '72%' : '100%' }}
          rounded="rounded-full"
        />
      ))}
    </div>
  )
}

export function SkeletonButton({ className = 'h-11 w-full', rounded = 'rounded-full' }){
  return (
    <SkeletonBlock
      className={className}
      rounded={rounded}
      aria-busy="true"
      aria-label="Loading"
    />
  )
}

export function SkeletonCard({ children, className = '' }){
  return (
    <motion.div
      className={`card skeleton-shell ${className}`}
      initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={spring.gentle}
      aria-busy="true"
      aria-label="Loading content"
    >
      {children}
    </motion.div>
  )
}

export function SkeletonPageIntro(){
  return (
    <SkeletonCard className="p-6">
      <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-3">
          <SkeletonBlock className="h-3 w-24" rounded="rounded-full" />
          <SkeletonBlock className="h-10 w-4/5 max-w-md" />
        </div>
        <div className="space-y-3 md:justify-self-end md:w-full md:max-w-lg">
          <SkeletonText lines={2} />
          <SkeletonBlock className="h-10 w-32 md:ml-auto" rounded="rounded-full" />
        </div>
      </div>
    </SkeletonCard>
  )
}

export function SkeletonAuthGate(){
  return (
    <SkeletonCard className="mx-auto max-w-xl p-6">
      <SkeletonBlock className="mx-auto h-12 w-12" rounded="rounded-2xl" />
      <SkeletonBlock className="mx-auto mt-5 h-6 w-56" />
      <SkeletonText lines={2} className="mx-auto mt-4 max-w-sm" />
      <div className="mt-6 space-y-3">
        <SkeletonBlock className="h-11 w-full" />
        <SkeletonBlock className="h-11 w-full" />
        <SkeletonBlock className="h-11 w-2/3 mx-auto" rounded="rounded-full" />
      </div>
    </SkeletonCard>
  )
}

export function SkeletonLetterRoom(){
  return (
    <div className="letter-room-shell skeleton-room" aria-busy="true" aria-label="Loading letter room">
      <div className="room-scene room-scene-original min-h-[820px]">
        <div className="cozy-room absolute inset-0">
          <div className="cozy-room-warm-wash" />
          <div className="cozy-room-grain" />
          <div className="cozy-room-vignette" />
        </div>
        <div className="room-paper-stage">
          <SkeletonCard className="w-full min-h-[24rem] p-6 !bg-[rgba(255,249,240,0.08)]">
            <SkeletonBlock className="h-3 w-32" rounded="rounded-full" />
            <SkeletonBlock className="mt-3 h-4 w-48" />
            <div className="mt-8 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-3" style={{ width: `${92 - i * 4}%` }} rounded="rounded-full" />
              ))}
            </div>
            <div className="mt-8 flex gap-3">
              <SkeletonBlock className="h-11 w-32" rounded="rounded-full" />
              <SkeletonBlock className="h-11 w-36" rounded="rounded-full" />
            </div>
          </SkeletonCard>
        </div>
      </div>
    </div>
  )
}

export function SkeletonDiaryPage(){
  return (
    <div className="space-y-6" aria-busy="true">
      <SkeletonCard className="min-h-[220px] overflow-hidden p-0">
        <div className="relative h-full min-h-[220px] p-6">
          <SkeletonBlock className="h-3 w-28" rounded="rounded-full" />
          <SkeletonBlock className="mt-3 h-8 w-64 max-w-full" />
          <SkeletonBlock className="mt-3 h-4 w-48" rounded="rounded-full" />
        </div>
      </SkeletonCard>
      <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        <SkeletonPageIntro />
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} className="p-5">
            <SkeletonBlock className="h-3 w-36" rounded="rounded-full" />
            <SkeletonText lines={3} className="mt-4" />
          </SkeletonCard>
        ))}
      </div>
      <aside className="space-y-4">
        <SkeletonCard className="p-4 min-h-[280px]">
          <SkeletonBlock className="h-5 w-28" />
          <div className="mt-4 grid grid-cols-7 gap-2">
            {Array.from({ length: 28 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-10" rounded="rounded-xl" />
            ))}
          </div>
        </SkeletonCard>
        <SkeletonCard className="p-4">
          <SkeletonBlock className="h-5 w-32" />
          <SkeletonText lines={3} className="mt-4" />
        </SkeletonCard>
      </aside>
      </div>
    </div>
  )
}

export function SkeletonQuotesBook(){
  return (
    <div className="grid md:grid-cols-4 gap-6" aria-busy="true">
      <SkeletonCard className="p-4 md:col-span-1">
        <SkeletonBlock className="h-3 w-20" rounded="rounded-full" />
        <SkeletonBlock className="mt-3 h-6 w-36" />
        {[0, 1, 2, 3, 4].map((i) => (
          <SkeletonBlock key={i} className="mt-3 h-11 w-full" rounded="rounded-2xl" />
        ))}
      </SkeletonCard>
      <SkeletonCard className="p-4 md:col-span-3">
        <div className="flex justify-between gap-4">
          <SkeletonBlock className="h-8 w-40" />
          <SkeletonBlock className="h-8 w-24" rounded="rounded-full" />
        </div>
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 rounded-[22px] border border-[var(--border)] p-4">
              <SkeletonText lines={2} className="flex-1" />
              <SkeletonBlock className="h-9 w-16 shrink-0" rounded="rounded-full" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  )
}

export function SkeletonChatBox(){
  return (
    <SkeletonCard className="flex h-[32rem] flex-col p-3" aria-busy="true">
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-[var(--border)] p-4">
        <div className="space-y-2 flex-1">
          <SkeletonBlock className="h-3 w-24" rounded="rounded-full" />
          <SkeletonBlock className="h-3 w-56" rounded="rounded-full" />
        </div>
        <SkeletonBlock className="h-6 w-16" rounded="rounded-full" />
      </div>
      <div className="flex-1 space-y-3 overflow-hidden pr-1">
        <SkeletonBlock className="ml-auto h-16 w-[68%]" rounded="rounded-[22px]" />
        <SkeletonBlock className="h-20 w-[74%]" rounded="rounded-[22px]" />
        <SkeletonBlock className="ml-auto h-14 w-[58%]" rounded="rounded-[22px]" />
      </div>
      <div className="mt-3 flex gap-2">
        <SkeletonBlock className="h-12 flex-1" rounded="rounded-2xl" />
        <SkeletonBlock className="h-12 w-24" rounded="rounded-full" />
      </div>
    </SkeletonCard>
  )
}

export function SkeletonHeroPreview(){
  return (
    <SkeletonCard className="relative min-h-[420px] overflow-hidden p-0">
      <div className="cozy-room cozy-room-compact absolute inset-0 !rounded-[inherit]">
        <div className="cozy-room-warm-wash" />
        <div className="cozy-room-grain" />
      </div>
      <div className="relative flex min-h-[420px] flex-col justify-end p-6 space-y-4">
        <SkeletonBlock className="h-6 w-40" />
        <SkeletonBlock className="h-16 w-full" rounded="rounded-2xl" />
      </div>
    </SkeletonCard>
  )
}

export default SkeletonBlock

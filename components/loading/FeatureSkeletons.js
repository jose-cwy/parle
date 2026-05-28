import LoadingShell from './LoadingShell'
import { CardSkeleton, PageSkeleton, SkeletonBlock, SkeletonText } from './SkeletonPrimitives'

export function PageIntroSkeleton() {
  return (
    <CardSkeleton className="hs-skeleton-card--intro p-6">
      <div className="hs-skeleton-grid-intro">
        <div className="space-y-3">
          <SkeletonBlock className="h-3 w-24" rounded="hs-skeleton-block--round-full" />
          <SkeletonBlock className="h-10 w-4/5 max-w-md" />
        </div>
        <div className="space-y-3 md:justify-self-end md:w-full md:max-w-lg">
          <SkeletonText lines={2} />
          <SkeletonBlock className="h-10 w-32 md:ml-auto" rounded="hs-skeleton-block--round-full" />
        </div>
      </div>
    </CardSkeleton>
  )
}

export function ChatSkeleton() {
  return (
    <LoadingShell message="Gathering your thoughts…" className="hs-loading-shell--inline">
      <CardSkeleton className="hs-skeleton-card--chat flex h-[32rem] flex-col p-3">
        <div className="hs-skeleton-chat-header mb-4">
          <div className="space-y-2 flex-1">
            <SkeletonBlock className="h-3 w-24" rounded="hs-skeleton-block--round-full" />
            <SkeletonBlock className="h-3 w-56" rounded="hs-skeleton-block--round-full" />
          </div>
          <SkeletonBlock className="h-6 w-16" rounded="hs-skeleton-block--round-full" />
        </div>
        <div className="flex-1 space-y-3 overflow-hidden pr-1">
          <SkeletonBlock className="ml-auto h-16 w-[68%] hs-skeleton-block--bubble" />
          <SkeletonBlock className="h-20 w-[74%] hs-skeleton-block--bubble" />
          <SkeletonBlock className="ml-auto h-14 w-[58%] hs-skeleton-block--bubble" />
        </div>
        <div className="mt-3 flex gap-2">
          <SkeletonBlock className="h-12 flex-1" rounded="hs-skeleton-block--round-lg" />
          <SkeletonBlock className="h-12 w-24" rounded="hs-skeleton-block--round-full" />
        </div>
      </CardSkeleton>
    </LoadingShell>
  )
}

export function LetterSkeleton() {
  return (
    <LoadingShell message="Preparing your quiet space…" className="hs-loading-shell--inline">
      <CardSkeleton className="hs-skeleton-card--letter w-full min-h-[24rem] p-6">
        <SkeletonBlock className="h-3 w-32" rounded="hs-skeleton-block--round-full" />
        <SkeletonBlock className="mt-3 h-4 w-48" rounded="hs-skeleton-block--round-full" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBlock
              key={i}
              className="h-3"
              style={{ width: `${92 - i * 4}%` }}
              rounded="hs-skeleton-block--round-full"
            />
          ))}
        </div>
        <div className="mt-8 flex gap-3">
          <SkeletonBlock className="h-11 w-32" rounded="hs-skeleton-block--round-full" />
          <SkeletonBlock className="h-11 w-36" rounded="hs-skeleton-block--round-full" />
        </div>
      </CardSkeleton>
    </LoadingShell>
  )
}

export function DiarySkeleton() {
  return (
    <LoadingShell message="Opening your private space…" className="hs-loading-shell--inline">
      <PageSkeleton className="space-y-6">
        <CardSkeleton className="hs-skeleton-card--hero min-h-[180px] p-6">
          <SkeletonBlock className="h-3 w-28" rounded="hs-skeleton-block--round-full" />
          <SkeletonBlock className="mt-3 h-8 w-64 max-w-full" />
          <SkeletonBlock className="mt-3 h-4 w-48" rounded="hs-skeleton-block--round-full" />
        </CardSkeleton>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <PageIntroSkeleton />
            {[0, 1, 2].map((i) => (
              <CardSkeleton key={i} className="p-5">
                <SkeletonBlock className="h-3 w-36" rounded="hs-skeleton-block--round-full" />
                <SkeletonText lines={3} className="mt-4" />
              </CardSkeleton>
            ))}
          </div>
          <aside className="space-y-4">
            <CardSkeleton className="p-4 min-h-[280px]">
              <SkeletonBlock className="h-5 w-28" />
              <div className="mt-4 grid grid-cols-7 gap-2">
                {Array.from({ length: 28 }).map((_, i) => (
                  <SkeletonBlock key={i} className="h-10" rounded="hs-skeleton-block--round-md" />
                ))}
              </div>
            </CardSkeleton>
            <CardSkeleton className="p-4">
              <SkeletonBlock className="h-5 w-32" />
              <SkeletonText lines={3} className="mt-4" />
            </CardSkeleton>
          </aside>
        </div>
      </PageSkeleton>
    </LoadingShell>
  )
}

export function QuotesSkeleton() {
  return (
    <LoadingShell message="Almost ready…" className="hs-loading-shell--inline">
      <div className="grid md:grid-cols-4 gap-6">
        <CardSkeleton className="p-4 md:col-span-1">
          <SkeletonBlock className="h-3 w-20" rounded="hs-skeleton-block--round-full" />
          <SkeletonBlock className="mt-3 h-6 w-36" />
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonBlock key={i} className="mt-3 h-11 w-full" rounded="hs-skeleton-block--round-lg" />
          ))}
        </CardSkeleton>
        <CardSkeleton className="p-4 md:col-span-3">
          <div className="flex justify-between gap-4">
            <SkeletonBlock className="h-8 w-40" />
            <SkeletonBlock className="h-8 w-24" rounded="hs-skeleton-block--round-full" />
          </div>
          <div className="mt-6 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="hs-skeleton-quote-row">
                <SkeletonText lines={2} className="flex-1" />
                <SkeletonBlock className="h-9 w-16 shrink-0" rounded="hs-skeleton-block--round-full" />
              </div>
            ))}
          </div>
        </CardSkeleton>
      </div>
    </LoadingShell>
  )
}

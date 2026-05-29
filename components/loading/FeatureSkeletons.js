import LoadingShell from './LoadingShell'
import { CardSkeleton, SkeletonBlock } from './SkeletonPrimitives'

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

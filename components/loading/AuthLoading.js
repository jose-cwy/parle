import LoadingShell from './LoadingShell'
import { CardSkeleton, SkeletonBlock, SkeletonText } from './SkeletonPrimitives'

export default function AuthLoading({ message = 'Opening your private space…' }) {
  return (
    <LoadingShell message={message} fullPage labelledBy="Checking your session">
      <CardSkeleton className="hs-skeleton-card--auth">
        <SkeletonBlock className="hs-skeleton-block--logo" rounded="hs-skeleton-block--round-lg" />
        <SkeletonBlock className="hs-skeleton-block--title mt-5" rounded="hs-skeleton-block--round-full" />
        <SkeletonText lines={2} className="mt-4 max-w-sm mx-auto" />
        <div className="hs-skeleton-form mt-6">
          <SkeletonBlock className="hs-skeleton-block--field" />
          <SkeletonBlock className="hs-skeleton-block--field" />
          <SkeletonBlock className="hs-skeleton-block--submit" rounded="hs-skeleton-block--round-full" />
        </div>
      </CardSkeleton>
    </LoadingShell>
  )
}

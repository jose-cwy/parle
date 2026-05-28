/**
 * @deprecated Import from `components/loading` instead.
 * Re-exports preserve existing import paths across the app.
 */
export {
  LOADING_MESSAGES,
  pickLoadingMessage,
  LoadingMark,
  LoadingShell,
  AppLoading,
  SkeletonBlock,
  SkeletonText,
  SkeletonButton,
  CardSkeleton,
  PageSkeleton,
  PageIntroSkeleton,
  ChatSkeleton,
  LetterSkeleton,
  DiarySkeleton,
  QuotesSkeleton,
  AuthLoading,
  SkeletonAuthGate,
  SkeletonChatBox,
  SkeletonLetterRoom,
  SkeletonDiaryPage,
  SkeletonQuotesBook,
  SkeletonPageIntro,
} from './loading'

export { SkeletonBlock as default } from './loading'

/** @deprecated Unused — kept as alias for DiarySkeleton */
export { DiarySkeleton as SkeletonHeroPreview } from './loading'

/** @deprecated Use CardSkeleton */
export { CardSkeleton as SkeletonCard } from './loading'

export { LOADING_MESSAGES, pickLoadingMessage } from './messages'
export { default as LoadingMark } from './LoadingMark'
export { default as LoadingShell } from './LoadingShell'
export { default as AuthLoading } from './AuthLoading'
export { default as AppLoading } from './AppLoading'
export { default as SkeletonAuthGate } from './AuthLoading'
export {
  SkeletonBlock,
  SkeletonText,
  SkeletonButton,
  CardSkeleton,
  PageSkeleton,
} from './SkeletonPrimitives'
export {
  PageIntroSkeleton,
  ChatSkeleton,
  LetterSkeleton,
  DiarySkeleton,
  QuotesSkeleton,
} from './FeatureSkeletons'

/* Backward-compatible names */
export { ChatSkeleton as SkeletonChatBox } from './FeatureSkeletons'
export { LetterSkeleton as SkeletonLetterRoom } from './FeatureSkeletons'
export { DiarySkeleton as SkeletonDiaryPage } from './FeatureSkeletons'
export { QuotesSkeleton as SkeletonQuotesBook } from './FeatureSkeletons'
export { PageIntroSkeleton as SkeletonPageIntro } from './FeatureSkeletons'

export { SkeletonBlock as default } from './SkeletonPrimitives'

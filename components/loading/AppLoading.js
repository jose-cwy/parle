import { useTopProgress } from '../../lib/hooks/useTopProgress'

/** @deprecated Visual replaced by global top progress bar — keeps API for callers. */
export default function AppLoading({ fullPage = true }) {
  useTopProgress(fullPage)
  return null
}

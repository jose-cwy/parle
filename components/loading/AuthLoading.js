import { useTopProgress } from '../../lib/hooks/useTopProgress'

/** @deprecated Visual replaced by global top progress bar — keeps API for callers. */
export default function AuthLoading() {
  useTopProgress(true)
  return null
}

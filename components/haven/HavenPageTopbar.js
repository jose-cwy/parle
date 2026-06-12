import { useRouter } from 'next/router'
import { ChevronLeft } from 'lucide-react'

export default function HavenPageTopbar({ label }) {
  const router = useRouter()

  return (
    <header className="haven-page-topbar">
      <button
        type="button"
        className="haven-page-topbar__back"
        onClick={() => router.push('/dashboard')}
      >
        <ChevronLeft size={16} strokeWidth={2} aria-hidden />
        <span>back</span>
      </button>
      <button
        type="button"
        className="haven-page-topbar__wordmark font-serif"
        onClick={() => router.push('/dashboard')}
      >
        parlé
      </button>
      <span className="haven-page-topbar__label">{label}</span>
    </header>
  )
}

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default function HavenPageTopbar({ label }) {
  return (
    <header className="haven-page-topbar">
      <Link href="/dashboard" prefetch className="haven-page-topbar__back">
        <ChevronLeft size={16} strokeWidth={2} aria-hidden />
        <span>back</span>
      </Link>
      <Link href="/dashboard" prefetch className="haven-page-topbar__wordmark font-serif">
        parlé
      </Link>
      <span className="haven-page-topbar__label">{label}</span>
    </header>
  )
}

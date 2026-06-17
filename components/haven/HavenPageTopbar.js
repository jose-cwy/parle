import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import ParleLogo from '../brand/ParleLogo'

export default function HavenPageTopbar({ label }) {
  return (
    <header className="haven-page-topbar">
      <Link href="/dashboard" prefetch className="haven-page-topbar__back">
        <ChevronLeft size={16} strokeWidth={2} aria-hidden />
        <span>back</span>
      </Link>
      <Link href="/dashboard" prefetch className="haven-page-topbar__wordmark" aria-label="parlé home">
        <ParleLogo variant="inline" size="md" />
      </Link>
      <span className="haven-page-topbar__label">{label}</span>
    </header>
  )
}

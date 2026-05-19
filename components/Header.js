import Link from 'next/link'

export default function Header(){
  return (
    <header className="w-full py-6 shadow-sm bg-transparent">
      <div className="container flex items-center justify-between">
        <Link href="/" className="text-2xl font-semibold" aria-label="Heartstrings Club">Heartstrings Club</Link>
        <nav className="space-x-4">
          <Link href="/diary" className="subtle">Diary</Link>
          <Link href="/chat" className="subtle">Chat</Link>
          <Link href="/quotes" className="subtle">Quotes</Link>
        </nav>
      </div>
    </header>
  )
}

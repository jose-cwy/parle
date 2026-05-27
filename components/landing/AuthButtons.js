import Link from 'next/link'

export default function AuthButtons({ variant = 'header' }) {
  const base = 'inline-flex items-center justify-center rounded-full text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'

  const loginClass =
    variant === 'menu'
      ? `${base} px-4 py-2 border border-[rgba(212,129,143,0.35)] text-[rgba(58,47,47,0.85)] hover:bg-white/40 focus-visible:ring-[rgba(212,129,143,0.55)] ring-offset-[rgba(253,248,246,1)]`
      : `${base} px-3 py-2 text-[rgba(58,47,47,0.8)] hover:text-[rgba(58,47,47,1)] hover:bg-white/30 focus-visible:ring-[rgba(212,129,143,0.55)] ring-offset-[rgba(253,248,246,1)]`

  const registerClass =
    variant === 'menu'
      ? `${base} px-4 py-2 bg-[#d4818f] text-white shadow-lg hover:shadow-xl hover:brightness-[1.02] focus-visible:ring-[rgba(212,129,143,0.55)] ring-offset-[rgba(253,248,246,1)]`
      : `${base} px-4 py-2 bg-[#d4818f] text-white shadow-md hover:shadow-lg hover:brightness-[1.02] focus-visible:ring-[rgba(212,129,143,0.55)] ring-offset-[rgba(253,248,246,1)]`

  return (
    <div className={variant === 'menu' ? 'flex gap-3' : 'hidden sm:flex items-center gap-3'}>
      <Link href="/login" className={loginClass}>
        Login
      </Link>
      <Link href="/register" className={registerClass}>
        Register
      </Link>
    </div>
  )
}


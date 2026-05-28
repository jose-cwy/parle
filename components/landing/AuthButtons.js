import Link from 'next/link'

export default function AuthButtons({ variant = 'header' }) {
  const isMenu = variant === 'menu'

  return (
    <div className={isMenu ? 'flex gap-3' : 'hidden sm:flex items-center gap-2.5'}>
      <Link
        href="/login"
        className={`hs-auth-btn hs-auth-btn--login${isMenu ? ' hs-auth-btn--menu' : ''}`}
      >
        Login
      </Link>
      <Link
        href="/register"
        className={`hs-auth-btn hs-auth-btn--register${isMenu ? ' hs-auth-btn--menu' : ''}`}
      >
        Sign up
      </Link>
    </div>
  )
}

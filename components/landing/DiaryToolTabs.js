import Link from 'next/link'
import { motion } from 'framer-motion'

const TABS = [
  { label: 'Chat', href: '/chat', primary: true },
  { label: 'Letter', href: '/letter-to-yourself' },
  { label: 'Diary', href: '/diary' },
  { label: 'Quotes', href: '/quotes' },
]

export default function DiaryToolTabs({ loggedIn, activeLabel = 'Chat' }) {
  function href(path) {
    return loggedIn ? path : `/login?next=${path}`
  }

  return (
    <nav className="diary-tabs" aria-label="Tools in your private archive">
      <ul className="diary-tabs__list">
        {TABS.map((tab) => {
          const isActive = tab.label === activeLabel
          return (
            <li key={tab.label}>
              <Link
                href={href(tab.href)}
                className={`diary-tabs__tab${isActive ? ' diary-tabs__tab--active' : ''}${tab.primary ? ' diary-tabs__tab--primary' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {isActive && (
                  <motion.span
                    layoutId="diary-tab-indicator"
                    className="diary-tabs__indicator"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="diary-tabs__label">{tab.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

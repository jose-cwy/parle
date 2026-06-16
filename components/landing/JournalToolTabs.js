import Link from 'next/link'
import { motion } from 'framer-motion'

const TABS = [
  { label: 'Chat', href: '/chat', primary: true },
  { label: 'Journal', href: '/journal' },
  { label: 'Quotes', href: '/quotes' },
]

export default function JournalToolTabs({ loggedIn, activeLabel = 'Chat' }) {
  const hrefFor = (path) => (loggedIn ? path : `/login?next=${encodeURIComponent(path)}`)

  return (
    <nav className="diary-tabs" aria-label="Tools in your private archive">
      <ul className="diary-tabs__list">
        {TABS.map((tab) => {
          const isActive = tab.label === activeLabel
          return (
            <li key={tab.label}>
              <Link
                href={hrefFor(tab.href)}
                className={`diary-tabs__tab${isActive ? ' diary-tabs__tab--active' : ''}${tab.primary ? ' diary-tabs__tab--primary' : ''}`}
              >
                {isActive ? (
                  <motion.span
                    layoutId="journal-tab-indicator"
                    className="diary-tabs__indicator"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                ) : null}
                <span className="diary-tabs__label">{tab.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

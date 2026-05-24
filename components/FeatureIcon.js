const icons = {
  letter: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16v10H4z" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  ),
  diary: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 4h12v16H6z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 6h14v9H9l-4 3z" />
    </svg>
  ),
  quotes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 10h4V6H7zM13 14h4v-4h-4z" />
      <path d="M5 18c1-3 2-4 4-4M15 18c1-3 2-4 4-4" />
    </svg>
  ),
}

export default function FeatureIcon({ name, className = '' }){
  return (
    <span className={`feature-icon ${className}`}>
      {icons[name]}
    </span>
  )
}

import Link from 'next/link'
function displayName(user) {
  if (!user?.email) return 'friend'
  return user.email.split('@')[0]
}

export default function DashboardHome({ user, firstTime = false, hasDiary = false, hasLetterDraft = false }) {
  const secondaryTools = [
    { href: '/letter-to-yourself', label: 'Write a letter' },
    { href: '/diary', label: 'Open diary' },
    { href: '/quotes', label: 'Browse quotes' },
  ]

  const continueSuggestion = (() => {
    if (hasLetterDraft) return { href: '/letter-to-yourself', title: 'Continue your letter', body: 'Finish the sentence you stopped on. Then seal it when you are ready.' }
    if (hasDiary) return { href: '/diary', title: 'Open today’s page', body: 'One honest paragraph is enough for tonight.' }
    return { href: '/letter-to-yourself', title: 'Start a closure letter', body: 'Write what you never got to say. Keep it private. Seal it when it feels done.' }
  })()

  return (
    <div className="dashboard-home">
      <p className="dashboard-home__eyebrow">Your private space</p>
      <h1 className="dashboard-home__title">
        Welcome back, {displayName(user)}.
      </h1>
      <p className="dashboard-home__lead">
        When it is loud inside your head, you do not need a performance. You need somewhere safe to put it.
      </p>

      <div className="dashboard-home__primary">
        <Link href="/chat" className="dashboard-home__cta-primary">
          Open Chat
        </Link>
        <p className="dashboard-home__cta-hint">Heartstrings listens without fixing you.</p>
      </div>

      <div className="dashboard-home__continue">
        <p className="dashboard-home__continue-label">Continue</p>
        <div className="dashboard-home__continue-card">
          <p className="dashboard-home__continue-title">{continueSuggestion.title}</p>
          <p className="dashboard-home__continue-body">{continueSuggestion.body}</p>
          <Link href={continueSuggestion.href} className="dashboard-home__continue-link">
            Go
          </Link>
        </div>
      </div>

      <ul className="dashboard-home__secondary">
        {secondaryTools.map((tool) => (
          <li key={tool.href}>
            <Link href={tool.href} className="dashboard-home__secondary-link">
              {tool.label}
            </Link>
          </li>
        ))}
      </ul>

      {firstTime && (
        <div className="dashboard-home__nudge">
          <p className="dashboard-home__nudge-title">First time here?</p>
          <p className="dashboard-home__nudge-body">
            If words feel stuck, try writing a letter to future-you. Seal it until you are ready.
          </p>
          <Link href="/letter-to-yourself" className="dashboard-home__nudge-link">
            Start your letter
          </Link>
        </div>
      )}

      <p className="dashboard-home__privacy">No feed. No audience. Just you.</p>
    </div>
  )
}

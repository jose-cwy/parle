export default function LandingSplash({
  message = 'Preparing your quiet space…',
  statusLabel = 'Just a moment',
}) {
  return (
    <div className="landing-splash rise" role="status" aria-live="polite" aria-busy="true">
      <div className="landing-splash__inner">
        <div className="landing-splash__mark" aria-hidden>
          <svg viewBox="0 0 32 32" className="h-12 w-12 heartstring">
            <path
              d="M16 25 C 7 19, 7 10, 13 10 C 16 10, 16 13, 16 13 C 16 13, 16 10, 19 10 C 25 10, 25 19, 16 25 Z"
              fill="none"
              stroke="var(--clay)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M16 13 C 16 18, 22 21, 28 19"
              fill="none"
              stroke="var(--rose)"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <p className="landing-splash__eyebrow">Heartstrings Club</p>
        <p className="landing-splash__message">
          {message.includes('quiet') ? (
            <>
              Preparing your <em>quiet space</em>…
            </>
          ) : (
            message
          )}
        </p>

        <div className="landing-splash__status">
          <div className="landing-splash__dots" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <span className="landing-splash__status-label">{statusLabel}</span>
        </div>
      </div>
    </div>
  )
}

import Link from 'next/link'
import LandingHero from './LandingHero'
import SpinningTestimonialMarquee from './SpinningTestimonialMarquee'
import ToolPreviewCards from './ToolPreviewCards'

const TOOLS = [
  {
    title: 'Chat',
    icon: 'C',
    description: 'Talk when you are ready. A listener that does not judge.',
    href: '/chat',
  },
  {
    title: 'Letter',
    icon: 'L',
    description: 'Write to your future self and seal it when you are done.',
    href: '/letter-to-yourself',
  },
  {
    title: 'Diary',
    icon: 'D',
    description: 'Private entries on the days that hurt most.',
    href: '/diary',
  },
  {
    title: 'Quotes',
    icon: 'Q',
    description: 'Short lines when you cannot find your own words.',
    href: '/quotes',
  },
]

function toolHref(loggedIn, path) {
  return loggedIn ? path : `/login?next=${path}`
}

export default function LandingPage({ loggedIn }) {
  const chatHref = toolHref(loggedIn, '/chat')
  const registerHref = '/register'

  return (
    <div className="landing-page">
      <div className="landing-page__grain" aria-hidden="true" />
      <LandingHero loggedIn={loggedIn} chatHref={chatHref} />

      <section id="how" className="landing-page__section" aria-labelledby="landing-how-title">
        <h2 id="landing-how-title" className="landing-page__section-title">
          How it works
        </h2>
        <p className="landing-page__section-lead">
          Four quiet tools for heartbreak — use one or all, at your own pace.
        </p>
        <div className="landing-page__tools-grid">
          {TOOLS.map((tool) => (
            <article key={tool.title} className="landing-page__tool-card">
              <span className="landing-page__tool-icon" aria-hidden="true">
                {tool.icon}
              </span>
              <h3>{tool.title}</h3>
              <p>{tool.description}</p>
              <Link href={toolHref(loggedIn, tool.href)}>Open {tool.title}</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-page__section" aria-labelledby="landing-preview-title">
        <h2 id="landing-preview-title" className="landing-page__section-title">
          See what it feels like
        </h2>
        <p className="landing-page__section-lead">
          Simple, private screens — no learning curve when you are already overwhelmed.
        </p>
        <ToolPreviewCards />
      </section>

      <section id="stories" className="landing-page__section" aria-labelledby="landing-stories-title">
        <h2 id="landing-stories-title" className="landing-page__section-title">
          Words from people who stayed
        </h2>
        <p className="landing-page__stories-intro">
          You are not the only one up late with this.
        </p>
        <SpinningTestimonialMarquee />
      </section>

      <section className="landing-page__section landing-page__cta-band" aria-labelledby="landing-cta-title">
        <h2 id="landing-cta-title" className="landing-page__section-title">
          Ready when you are
        </h2>
        <p className="landing-page__section-lead">
          One honest sentence is enough to begin.
        </p>
        <div className="landing-page__cta-row">
          <Link href={chatHref} className="landing-page__cta-primary">
            Talk it out
          </Link>
          {!loggedIn && (
            <Link href={registerHref} className="landing-page__cta-secondary">
              Create account
            </Link>
          )}
        </div>
      </section>

      <footer className="landing-page__footer-note">
        <p>No feed. Just you.</p>
        {!loggedIn && (
          <p style={{ marginTop: '0.75rem' }}>
            <Link href="/login">Log in</Link>
          </p>
        )}
      </footer>
    </div>
  )
}

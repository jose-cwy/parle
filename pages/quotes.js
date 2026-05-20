import QuotesBook from '../components/QuotesBook'
import RequireAuth from '../components/RequireAuth'
import Reveal from '../components/Reveal'

export default function Quotes(){
  return (
    <RequireAuth>
      <div className="space-y-6">
        <Reveal>
          <div className="grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#8c6147]">Quotes library</p>
              <h2 className="mt-2 section-title text-[#241e1a]">Words that move with where you are.</h2>
            </div>
            <p className="subtle text-base leading-7">Explore curated chapters, shift between emotional states, and save the lines you want waiting for you later.</p>
          </div>
        </Reveal>
        <QuotesBook />
      </div>
    </RequireAuth>
  )
}

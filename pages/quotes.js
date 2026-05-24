import QuotesBook from '../components/QuotesBook'
import PageIntro from '../components/PageIntro'
import RequireAuth from '../components/RequireAuth'

export default function Quotes(){
  return (
    <RequireAuth>
      <div className="space-y-6">
        <PageIntro
          eyebrow="Quotes library"
          title="Words that move with where you are."
          description="Explore curated chapters, shift between emotional states, and save the lines you want waiting for you later."
        />
        <QuotesBook />
      </div>
    </RequireAuth>
  )
}

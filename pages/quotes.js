import QuotesBook from '../components/QuotesBook'
import PageIntro from '../components/PageIntro'
import RequireAuth from '../components/RequireAuth'
import AppShell from '../components/AppShell'

export default function Quotes(){
  return (
    <RequireAuth>
      <AppShell>
        <div className="space-y-6">
          <PageIntro
            eyebrow="Quotes library"
            title="Words that move with where you are."
            description="Save a line for the nights you need something to hold onto. No feed, no noise, just words that land gently."
          />
          <QuotesBook />
        </div>
      </AppShell>
    </RequireAuth>
  )
}

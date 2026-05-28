import QuotesBook from '../components/QuotesBook'
import PageIntro from '../components/PageIntro'
import RequireAuth from '../components/RequireAuth'
import AppShell from '../components/AppShell'
import AppPage from '../components/app/AppPage'

export default function Quotes(){
  return (
    <RequireAuth>
      <AppShell>
        <AppPage>
          <PageIntro
            eyebrow="Quotes library"
            title="Words that meet you where you are"
            description="Save a line for the nights you need something to hold onto. No feed, no noise — just words that land gently."
          />
          <QuotesBook />
        </AppPage>
      </AppShell>
    </RequireAuth>
  )
}

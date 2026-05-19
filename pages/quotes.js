import QuotesBook from '../components/QuotesBook'

export default function Quotes(){
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Quotes Book</h2>
      <p className="subtle mb-4">Explore curated chapters and save favorites to revisit later.</p>
      <QuotesBook />
    </div>
  )
}

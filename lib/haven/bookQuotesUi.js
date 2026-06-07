export const CHAPTER_INTROS = {
  Heartbreak:
    'For the first nights, when the room is too quiet and the phone is too loud.',
  Healing: 'For the days you are learning to breathe again.',
  'Self-Worth': 'For remembering that being left does not make you less.',
  'Letting Go': 'For loosening your grip without denying what mattered.',
  'Moving On': 'For the small steps forward, even when they feel quiet.',
}

export function defaultIntro(chapter) {
  return CHAPTER_INTROS[chapter] || 'Words for where you are right now.'
}

export function quoteSizeClass(text) {
  const len = text?.length ?? 0
  if (len < 60) return 'haven-quotes-book__quote-text--short'
  if (len < 120) return 'haven-quotes-book__quote-text--medium'
  return 'haven-quotes-book__quote-text--long'
}

export function QuoteTextContent({ text }) {
  const tailMatch = text.match(/^(.*?)(\S[—–-])$/)
  if (tailMatch) {
    return (
      <>
        {tailMatch[1]}
        <span className="haven-quotes-book__quote-tail">{tailMatch[2]}</span>
      </>
    )
  }
  return text
}

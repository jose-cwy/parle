/**
 * Landing mood-board asset paths — swap files in public/images/moodboard/
 * when replacing placeholders with final commissioned art.
 */
const MOODBOARD = '/images/moodboard'
const LANDING = '/images/landing'

export const landingAssets = {
  heroDeskJournal: `${MOODBOARD}/hero-desk-journal.png`,
  heroBedroom: `${MOODBOARD}/hero-bedroom.png`,
  drawerJournalHeader: `${MOODBOARD}/drawer-journal-header.png`,
  drawerPaper: `${MOODBOARD}/drawer-paper.png`,
  charactersGrid: `${MOODBOARD}/characters-grid.png`,
  lineShop: `${MOODBOARD}/line-shop.png`,
  storiesDeskNight: `${MOODBOARD}/stories-desk-night.png`,
  /** Sunset landing fallback poster (temporary until commissioned art exists). */
  sunsetPoster: `${LANDING}/sunset-ref.png`,
  boardPhoto: `${LANDING}/board-ref.png`,
  /** Diary archive beats — swap when final spread art is ready */
  spreadChat: `${MOODBOARD}/hero-desk-journal.png`,
  spreadLetter: `${MOODBOARD}/drawer-paper.png`,
  spreadDiary: `${MOODBOARD}/hero-bedroom.png`,
  spreadQuotes: `${MOODBOARD}/stories-desk-night.png`,
}

/** 4×4 grid — avatar index 0–15 for testimonial cards */
export function characterAvatarStyle(index) {
  const col = index % 4
  const row = Math.floor(index / 4)
  const x = (col / 3) * 100
  const y = (row / 3) * 100
  return {
    backgroundImage: `url(${landingAssets.charactersGrid})`,
    backgroundSize: '400% 400%',
    backgroundPosition: `${x}% ${y}%`,
  }
}

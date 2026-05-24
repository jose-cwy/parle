/**
 * NotebookPage — the cream paper notebook floating in the dark canvas.
 * Contains grid texture, margin line, spiral holes, and torn-bottom edge.
 */
export default function NotebookPage({ children, className = '' }) {
  return (
    <div className={`notebook ${className}`}>
      {/* Spiral holes at top */}
      <div className="spiral-holes" aria-hidden="true">
        {[...Array(14)].map((_, i) => (
          <span key={i} className="spiral-hole" />
        ))}
      </div>

      {/* Grid paper texture */}
      <div className="notebook-grid" aria-hidden="true" />

      {/* Red margin line */}
      <div className="notebook-margin" aria-hidden="true" />

      {/* Content — sits above grid and margin */}
      <div className="relative z-[2]">
        {children}
      </div>

      {/* Torn bottom edge SVG */}
      <svg
        className="notebook-torn-edge"
        viewBox="0 0 1200 18"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0,0 Q30,14 60,4 T120,10 T180,3 T240,12 T300,5 T360,13 T420,4 T480,11 T540,3 T600,12 T660,5 T720,13 T780,4 T840,11 T900,3 T960,12 T1020,5 T1080,13 T1140,4 T1200,10 L1200,18 L0,18 Z"
          fill="#e8d4bc"
        />
      </svg>
    </div>
  )
}

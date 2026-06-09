export default function TopProgressBar({ visible, opacity, width, completing }) {
  if (!visible && opacity <= 0) return null

  return (
    <div
      className="top-progress"
      style={{ opacity }}
      aria-hidden="true"
    >
      <div
        className={`top-progress__bar${completing ? ' top-progress__bar--completing' : ''}`}
        style={{
          width: `${width}%`,
          transition: completing
            ? 'width 300ms ease-in-out'
            : 'width 120ms ease-out',
        }}
      />
    </div>
  )
}

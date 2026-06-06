export default function TopProgressBar({ visible, opacity, width, completing }) {
  if (!visible && opacity <= 0) return null

  return (
    <div
      className="top-progress"
      style={{ opacity }}
      aria-hidden="true"
    >
      <div
        className="top-progress__bar"
        style={{
          width: `${width}%`,
          transition: completing
            ? `width ${300}ms ease-in-out`
            : `width ${200}ms ease-out`,
        }}
      />
    </div>
  )
}

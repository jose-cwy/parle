import { cn } from '../../lib/cn'

const SIZES = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 28,
  xl: 36,
}

/**
 * parlé mark — ring, inner disc, top arc.
 * @param {'default' | 'inverted' | 'onDark'} variant
 */
export default function ParleMark({
  variant = 'default',
  size = 'md',
  className,
  title,
}) {
  const px = typeof size === 'number' ? size : SIZES[size] || SIZES.md
  const ink = 'var(--parle-brand-ink)'
  const cream = 'var(--parle-brand-cream)'

  let ring = ink
  let inner = cream
  let arc = ink

  if (variant === 'inverted') {
    ring = cream
    inner = ink
    arc = cream
  } else if (variant === 'onDark') {
    ring = cream
    inner = ink
    arc = cream
  }

  return (
    <svg
      viewBox="0 0 32 32"
      width={px}
      height={px}
      className={cn('parle-mark shrink-0', className)}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <circle cx="16" cy="16" r="13" fill="none" stroke={ring} strokeWidth="2.75" />
      <circle cx="16" cy="16" r="8.25" fill={inner} />
      <path
        d="M 10.75 14.1 Q 16 10.15 21.25 14.1"
        fill="none"
        stroke={arc}
        strokeWidth="1.65"
        strokeLinecap="round"
      />
    </svg>
  )
}

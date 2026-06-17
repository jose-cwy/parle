import { cn } from '../../lib/cn'
import ParleMark from './ParleMark'

const MARK_SIZE = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
}

/**
 * @param {'inline' | 'icon' | 'pill'} variant — pill is treated as inline (no background)
 */
export default function ParleLogo({
  variant = 'inline',
  size = 'md',
  showText = true,
  className,
  textClassName,
  markClassName,
}) {
  if (variant === 'icon') {
    return (
      <span className={cn('parle-logo parle-logo--icon', className)}>
        <ParleMark size={MARK_SIZE[size] || size} variant="default" className={markClassName} />
      </span>
    )
  }

  const resolvedSize = size === 'sm' || size === 'md' || size === 'lg' ? size : 'md'

  return (
    <span className={cn('parle-logo parle-logo--inline', `parle-logo--${resolvedSize}`, className)}>
      <ParleMark size={MARK_SIZE[resolvedSize]} variant="default" className={markClassName} />
      {showText ? (
        <span className={cn('parle-logo__text font-serif', textClassName)}>parlé</span>
      ) : null}
    </span>
  )
}

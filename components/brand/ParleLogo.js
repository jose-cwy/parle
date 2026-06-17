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
    const iconMarkSize = size === 'sm' ? 'md' : size === 'md' ? 'lg' : MARK_SIZE[size] || size
    return (
      <span className={cn('parle-logo parle-logo--icon', className)}>
        <ParleMark size={iconMarkSize} variant="default" className={markClassName} />
      </span>
    )
  }

  const resolvedSize = size === 'sm' || size === 'md' || size === 'lg' ? size : 'md'
  const markSize = resolvedSize === 'sm' ? 'md' : resolvedSize === 'md' ? 'lg' : 'xl'

  return (
    <span className={cn('parle-logo parle-logo--inline', `parle-logo--${resolvedSize}`, className)}>
      <ParleMark size={markSize} variant="default" className={markClassName} />
      {showText ? (
        <span className={cn('parle-logo__text font-serif', textClassName)}>parlé</span>
      ) : null}
    </span>
  )
}

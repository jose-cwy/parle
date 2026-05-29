import { cn } from '../../lib/cn'

export default function HavenModal({ children, onClose, small }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-4 bg-ink/30 backdrop-blur-sm"
      style={{ animation: 'haven-fadeIn 180ms ease' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'paper relative w-full p-7 md:p-8',
          small ? 'max-w-md' : 'max-w-xl',
        )}
        style={{ animation: 'haven-rise 240ms cubic-bezier(.2,.7,.2,1)' }}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  )
}

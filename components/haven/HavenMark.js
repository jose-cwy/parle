import { cn } from '../../lib/cn'

export default function HavenMark({ expanded }) {
  return (
    <div
      className={cn(
        'flex items-center h-10',
        expanded ? 'gap-2.5 px-1.5' : 'justify-center w-10 mx-auto',
      )}
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0 heartstring" aria-hidden>
        <path
          d="M16 25 C 7 19, 7 10, 13 10 C 16 10, 16 13, 16 13 C 16 13, 16 10, 19 10 C 25 10, 25 19, 16 25 Z"
          fill="none"
          stroke="var(--clay)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 13 C 16 18, 22 21, 28 19"
          fill="none"
          stroke="var(--rose)"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
      <div
        className={cn(
          'leading-tight whitespace-nowrap overflow-hidden transition-all duration-300',
          expanded ? 'opacity-100 max-w-[140px]' : 'opacity-0 max-w-0',
        )}
      >
        <div className="font-serif text-[15px] text-foreground">Heartstrings</div>
        <div className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground">club</div>
      </div>
    </div>
  )
}

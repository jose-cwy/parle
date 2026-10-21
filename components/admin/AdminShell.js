import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  LayoutDashboard,
  Users,
  MessagesSquare,
  Heart,
  Repeat,
  Cpu,
  Shield,
  ArrowUpRight,
} from 'lucide-react'
import { cn } from '../../lib/cn'

const NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/conversations', label: 'Conversations', icon: MessagesSquare },
  { href: '/admin/feedback', label: 'Feedback', icon: Heart },
  { href: '/admin/retention', label: 'Retention', icon: Repeat },
  { href: '/admin/ai', label: 'AI Performance', icon: Cpu },
  { href: '/admin/ops', label: 'Administration', icon: Shield },
]

function isActive(pathname, item) {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export default function AdminShell({ children }) {
  const router = useRouter()
  return (
    <div className="admin-shell">
      <aside className="admin-shell__rail" aria-label="Admin">
        <div className="admin-shell__brand">
          parlé
          <span>Control Centre</span>
        </div>
        {NAV.map((item) => {
          const Icon = item.icon
          const active = isActive(router.pathname, item)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn('admin-shell__link', active && 'is-active')}
            >
              <Icon size={16} strokeWidth={1.75} />
              {item.label}
            </Link>
          )
        })}
        <Link href="/dashboard" className="admin-shell__link admin-shell__exit">
          <ArrowUpRight size={16} />
          Open Parlé
        </Link>
      </aside>
      <div className="admin-shell__main">{children}</div>
    </div>
  )
}

export function AdminRange({ range, from, to }) {
  const router = useRouter()
  const chips = [
    { id: '7', label: '7 days' },
    { id: '30', label: '30 days' },
    { id: '90', label: '90 days' },
  ]
  return (
    <div className="admin-range">
      {chips.map((chip) => (
        <Link
          key={chip.id}
          href={{ pathname: router.pathname, query: { range: chip.id } }}
          className={range === chip.id ? 'is-active' : ''}
        >
          {chip.label}
        </Link>
      ))}
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          router.push({
            pathname: router.pathname,
            query: {
              range: 'custom',
              from: String(form.get('from') || ''),
              to: String(form.get('to') || ''),
            },
          })
        }}
      >
        <input type="date" name="from" defaultValue={from || ''} className="admin-search input bg-[#161214] text-[12px] px-2 py-1 rounded-md" />
        <input type="date" name="to" defaultValue={to || ''} className="admin-search input bg-[#161214] text-[12px] px-2 py-1 rounded-md" />
        <button type="submit" className={range === 'custom' ? 'is-active' : ''}>
          Custom
        </button>
      </form>
    </div>
  )
}

export function AdminKpi({ label, value, hint }) {
  return (
    <div className="admin-kpi">
      <div className="admin-kpi__label">{label}</div>
      <div className="admin-kpi__value">{value}</div>
      {hint ? <div className="admin-kpi__hint">{hint}</div> : null}
    </div>
  )
}

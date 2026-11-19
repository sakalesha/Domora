import { AlertTriangleIcon } from '../icons/Icons'

interface CampStatusBadgeProps {
  status: string
}

const statusConfig: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  open: {
    label: 'Open',
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-800',
    dot: 'bg-emerald-600',
  },
  confirmed: {
    label: 'Confirmed',
    bg: 'bg-teal-50 border-teal-200',
    text: 'text-teal-800',
    dot: 'bg-teal-600',
  },
  in_progress: {
    label: 'In Progress',
    bg: 'bg-sky-50 border-sky-200',
    text: 'text-sky-800',
    dot: 'bg-sky-600',
  },
  completed: {
    label: 'Completed',
    bg: 'bg-slate-100 border-slate-300',
    text: 'text-slate-700',
    dot: 'bg-slate-500',
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-rose-50 border-rose-200',
    text: 'text-rose-800',
    dot: 'bg-rose-600',
  },
}

export function CampStatusBadge({ status }: CampStatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    bg: 'bg-surface-subtle border-border',
    text: 'text-body',
    dot: 'bg-muted',
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-0.5 text-xs font-semibold leading-5 ${config.bg} ${config.text}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  )
}

export interface RiskBadgeProps {
  level: 'critical' | 'warning'
  message: string
}

export function RiskBadge({ level, message }: RiskBadgeProps) {
  if (level === 'critical') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-sm border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-800">
        <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0 text-rose-600" />
        <span>{message}</span>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
      <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0 text-amber-600" />
      <span>{message}</span>
    </span>
  )
}

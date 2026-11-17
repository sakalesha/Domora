interface CampStatusBadgeProps {
  status: string
}

const statusConfig: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  open: {
    label: 'Open for Booking',
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
  },
  confirmed: {
    label: 'Confirmed',
    bg: 'bg-teal-50 border-teal-200',
    text: 'text-teal-800',
    dot: 'bg-teal-500',
  },
  in_progress: {
    label: 'In Progress',
    bg: 'bg-sky-50 border-sky-200',
    text: 'text-sky-800',
    dot: 'bg-sky-500',
  },
  completed: {
    label: 'Completed',
    bg: 'bg-purple-50 border-purple-200',
    text: 'text-purple-800',
    dot: 'bg-purple-500',
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-rose-50 border-rose-200',
    text: 'text-rose-800',
    dot: 'bg-rose-500',
  },
}

export function CampStatusBadge({ status }: CampStatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    bg: 'bg-gray-50 border-gray-200',
    text: 'text-gray-700',
    dot: 'bg-gray-400',
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
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
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
        {message}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      {message}
    </span>
  )
}

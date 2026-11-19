import { useEffect } from 'react'

export function formatPaiseToRupees(paise: number): string {
  const safePaise = Number.isFinite(paise) ? paise : 0
  return `₹${(safePaise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

export function calculateDiscountedPricePaise(
  basePricePaise: number,
  discountPct: number,
): number {
  const safeBase = Number.isFinite(basePricePaise) ? Math.max(0, Math.round(basePricePaise)) : 0
  const safePct = Number.isFinite(discountPct)
    ? Math.min(100, Math.max(0, Math.round(discountPct)))
    : 0
  return Math.floor((safeBase * (100 - safePct) + 50) / 100)
}

export function formatDateOnly(isoString: string): string {
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(isoString: string): string {
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function formatTimeOnly(isoString: string): string {
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title
  }, [title])
}

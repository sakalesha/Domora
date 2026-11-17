import { useState, type ReactNode, type SVGProps } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import {
  BuildingIcon,
  ChevronRightIcon,
  DashboardIcon,
  LogOutIcon,
  MenuIcon,
  PlusIcon,
  VendorIcon,
  XIcon,
} from '../icons/Icons'

export interface BreadcrumbItem {
  label: string
  to?: string
}

interface NavItem {
  label: string
  to: string
  icon: (props: SVGProps<SVGSVGElement>) => ReactNode
  exact?: boolean
  badge?: number
  badgeText?: string
}

interface NavGroup {
  group: string
  items: NavItem[]
}

interface OpsLayoutProps {
  children: ReactNode
  breadcrumbs?: BreadcrumbItem[]
  title?: string
  subtitle?: string
  actions?: ReactNode
  attentionCount?: number
}

export function OpsLayout({
  children,
  breadcrumbs = [{ label: 'Operations', to: '/ops' }],
  title,
  subtitle,
  actions,
  attentionCount,
}: OpsLayoutProps) {
  const { auth, signOut } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const user = auth.status === 'authenticated' ? auth.user : null
  const userInitials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'OP'

  const navItems: NavGroup[] = [
    {
      group: 'Operations',
      items: [
        {
          label: 'Dashboard & Camps',
          to: '/ops',
          icon: DashboardIcon,
          exact: true,
          badge: attentionCount && attentionCount > 0 ? attentionCount : undefined,
        },
        {
          label: 'Create New Camp',
          to: '/ops/camps/new',
          icon: PlusIcon,
          exact: true,
        },
      ],
    },
    {
      group: 'Directory Reference',
      items: [
        {
          label: 'Partner Vendors',
          to: '/ops?tab=vendors',
          icon: VendorIcon,
          badgeText: 'Active',
        },
        {
          label: 'Societies & Codes',
          to: '/ops?tab=societies',
          icon: BuildingIcon,
          badgeText: 'Live',
        },
      ],
    },
  ]

  const isCurrent = (to: string, exact = false) => {
    if (exact) return location.pathname === to
    return location.pathname.startsWith(to)
  }

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-surface">
      {/* Brand & Workspace Header */}
      <div>
        <div className="flex h-16 items-center justify-between border-b border-border/30 px-6">
          <Link to="/ops" className="flex items-center gap-2.5 group">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white shadow-sm transition group-hover:bg-accent-pressed">
              D
            </span>
            <div className="leading-tight">
              <span className="block text-sm font-bold tracking-tight text-ink">
                Domora Ops
              </span>
              <span className="block text-[11px] font-medium text-muted">
                Operations Portal
              </span>
            </div>
          </Link>
          <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
            Live
          </span>
        </div>

        {/* Navigation Groups */}
        <nav className="space-y-6 px-4 py-5" aria-label="Sidebar">
          {navItems.map((group) => (
            <div key={group.group}>
              <h3 className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted/80">
                {group.group}
              </h3>
              <ul className="mt-2 space-y-1">
                {group.items.map((item) => {
                  const active = isCurrent(item.to, item.exact)
                  const Icon = item.icon
                  return (
                    <li key={item.label}>
                      <Link
                        to={item.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition active:scale-[0.98] ${
                          active
                            ? 'bg-accent/10 font-semibold text-accent'
                            : 'text-body hover:bg-canvas hover:text-ink'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon
                            className={`h-4 w-4 transition ${
                              active ? 'text-accent' : 'text-muted group-hover:text-ink'
                            }`}
                          />
                          <span>{item.label}</span>
                        </div>
                        {item.badge ? (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800 animate-pulse">
                            {item.badge}
                          </span>
                        ) : null}
                        {item.badgeText ? (
                          <span className="rounded border border-border/40 bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-muted">
                            {item.badgeText}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* User Profile & Session Footer */}
      <div className="border-t border-border/30 p-4">
        <div className="flex items-center justify-between rounded-xl bg-canvas p-2.5">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
              {userInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-ink">
                {user?.full_name ?? 'Ops Coordinator'}
              </p>
              <p className="truncate text-[11px] text-muted capitalize">
                {user?.role ?? 'ops'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            title="Log out"
            aria-label="Log out"
            className="rounded-lg p-1.5 text-muted transition hover:bg-surface hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <LogOutIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-canvas text-ink antialiased">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-border/30 lg:block">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer Backdrop & Panel */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-full bg-surface shadow-2xl">
            <div className="flex h-14 items-center justify-between border-b border-border/30 px-6">
              <span className="text-sm font-bold tracking-tight text-ink">Menu</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1.5 text-muted hover:bg-canvas"
                aria-label="Close navigation"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="h-[calc(100vh-3.5rem)]">{sidebarContent}</div>
          </div>
        </div>
      )}

      {/* Main Operational Container */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top App Bar with Breadcrumbs & Actions */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/30 bg-surface/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-2 text-muted hover:bg-canvas lg:hidden"
              aria-label="Open navigation menu"
            >
              <MenuIcon className="h-5 w-5" />
            </button>

            {/* Breadcrumb Trail */}
            <nav className="flex items-center space-x-1.5 text-xs text-muted" aria-label="Breadcrumb">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1
                return (
                  <div key={crumb.label} className="flex items-center gap-1.5">
                    {idx > 0 && <ChevronRightIcon className="h-3 w-3 text-border" />}
                    {crumb.to && !isLast ? (
                      <Link
                        to={crumb.to}
                        className="font-medium hover:text-ink transition hover:underline underline-offset-2"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className={`font-semibold ${isLast ? 'text-ink' : ''}`}>
                        {crumb.label}
                      </span>
                    )}
                  </div>
                )
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/ops/camps/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-pressed active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>Create Camp</span>
            </Link>
          </div>
        </header>

        {/* Page Header (if title specified) */}
        {title ? (
          <div className="border-b border-border/20 bg-surface/50 px-4 py-5 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mt-1 text-xs text-muted sm:text-sm">{subtitle}</p>
                ) : null}
              </div>
              {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
            </div>
          </div>
        ) : null}

        {/* Main Body */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}

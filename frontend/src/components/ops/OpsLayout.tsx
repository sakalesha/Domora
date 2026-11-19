import { useEffect, useState, type ReactNode, type SVGProps } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { useDocumentTitle } from '../../utils/format'
import {
  BuildingIcon,
  ChevronRightIcon,
  DashboardIcon,
  DomoraMark,
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
  badge?: number
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
  hideTopBarCreate?: boolean
}

export function OpsLayout({
  children,
  breadcrumbs = [{ label: 'Operations', to: '/ops' }],
  title,
  subtitle,
  actions,
  attentionCount,
  hideTopBarCreate = false,
}: OpsLayoutProps) {
  const { auth, signOut } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useDocumentTitle(title ? `${title} | Domora Ops` : 'Operations Portal | Domora')

  useEffect(() => {
    if (!mobileMenuOpen) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileMenuOpen])

  const user = auth.status === 'authenticated' ? auth.user : null
  const userInitials = user?.full_name
    ? user.full_name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'OP'

  const currentSearch = new URLSearchParams(location.search)
  const activeDirectoryTab = currentSearch.get('tab')
  const showTopCreateCta =
    !hideTopBarCreate && location.pathname !== '/ops/camps/new'

  const navItems: NavGroup[] = [
    {
      group: 'Operations',
      items: [
        {
          label: 'Dashboard & Camps',
          to: '/ops',
          icon: DashboardIcon,
          badge: attentionCount && attentionCount > 0 ? attentionCount : undefined,
        },
        {
          label: 'Create New Camp',
          to: '/ops/camps/new',
          icon: PlusIcon,
        },
      ],
    },
    {
      group: 'Directory',
      items: [
        {
          label: 'Partner Vendors',
          to: '/ops?tab=vendors',
          icon: VendorIcon,
        },
        {
          label: 'Societies & Codes',
          to: '/ops?tab=societies',
          icon: BuildingIcon,
        },
      ],
    },
  ]

  function isItemActive(to: string): boolean {
    if (to === '/ops?tab=vendors') {
      return location.pathname === '/ops' && activeDirectoryTab === 'vendors'
    }
    if (to === '/ops?tab=societies') {
      return location.pathname === '/ops' && activeDirectoryTab === 'societies'
    }
    if (to === '/ops') {
      return (
        (location.pathname === '/ops' || location.pathname === '/ops/camps') &&
        !activeDirectoryTab
      )
    }
    return location.pathname === to
  }

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-surface">
      <div>
        {/* Brand Header */}
        <div className="flex h-16 items-center border-b border-border px-5">
          <Link
            to="/ops"
            className="group flex items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-accent text-on-accent shadow-card transition-colors group-hover:bg-accent-pressed">
              <DomoraMark className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <span className="block font-display text-sm font-bold tracking-tight text-ink">
                Domora
              </span>
              <span className="block text-xs font-medium text-muted">
                Operations Portal
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Groups */}
        <nav className="space-y-6 px-3.5 py-5" aria-label="Sidebar">
          {navItems.map((group) => (
            <div key={group.group}>
              <h3 className="px-2.5 text-xs font-semibold uppercase tracking-wider text-muted">
                {group.group}
              </h3>
              <ul className="mt-2 space-y-1">
                {group.items.map((item) => {
                  const active = isItemActive(item.to)
                  const Icon = item.icon
                  return (
                    <li key={item.label}>
                      <Link
                        to={item.to}
                        onClick={() => setMobileMenuOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={`group flex items-center justify-between rounded-sm px-2.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          active
                            ? 'bg-accent-soft font-semibold text-accent'
                            : 'text-body hover:bg-surface-subtle hover:text-ink'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon
                            className={`h-4 w-4 shrink-0 transition-colors ${
                              active ? 'text-accent' : 'text-muted group-hover:text-ink'
                            }`}
                          />
                          <span>{item.label}</span>
                        </div>
                        {item.badge ? (
                          <span className="rounded-sm bg-rose-50 px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-rose-800 border border-rose-200">
                            {item.badge}
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
      <div className="border-t border-border p-3.5">
        <div className="flex items-center justify-between rounded-md border border-border bg-canvas p-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-accent-soft font-display text-xs font-bold text-accent">
              {userInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {user?.full_name ?? 'Ops Coordinator'}
              </p>
              <p className="truncate text-xs capitalize text-muted">
                {user?.role ?? 'ops'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            title="Log out"
            aria-label="Log out"
            className="rounded-sm p-1.5 text-muted transition-colors hover:bg-surface hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
      <aside className="hidden w-64 shrink-0 border-r border-border lg:block">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer Backdrop & Panel */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-full bg-surface shadow-modal">
            <div className="flex h-16 items-center justify-between border-b border-border px-5">
              <span className="font-display text-sm font-bold tracking-tight text-ink">
                Navigation
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-sm p-1.5 text-muted hover:bg-surface-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Close navigation"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="h-[calc(100vh-4rem)]">{sidebarContent}</div>
          </div>
        </div>
      )}

      {/* Main Operational Container */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top App Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-surface px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-sm p-2 text-muted hover:bg-surface-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
              aria-label="Open navigation menu"
            >
              <MenuIcon className="h-5 w-5" />
            </button>

            <nav className="flex min-w-0 items-center gap-1.5 text-sm text-muted" aria-label="Breadcrumb">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1
                return (
                  <div
                    key={`${crumb.label}-${idx}`}
                    className={`min-w-0 items-center gap-1.5 ${
                      isLast ? 'flex' : 'hidden sm:flex'
                    }`}
                  >
                    {idx > 0 && (
                      <ChevronRightIcon className="hidden h-3.5 w-3.5 shrink-0 text-border-strong sm:block" />
                    )}
                    {crumb.to && !isLast ? (
                      <Link
                        to={crumb.to}
                        className="truncate font-medium transition-colors hover:text-ink hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className={`truncate ${isLast ? 'font-semibold text-ink' : 'font-medium'}`}>
                        {crumb.label}
                      </span>
                    )}
                  </div>
                )
              })}
            </nav>
          </div>

          {showTopCreateCta ? (
            <div className="flex shrink-0 items-center gap-3">
              <Link
                to="/ops/camps/new"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm bg-accent px-3.5 py-2 text-sm font-semibold text-on-accent shadow-card transition-colors hover:bg-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                <PlusIcon className="h-4 w-4" />
                <span>Create Camp</span>
              </Link>
            </div>
          ) : null}
        </header>

        {/* Page Header */}
        {title ? (
          <div className="border-b border-border bg-surface px-4 py-5 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mt-1 text-sm text-muted">{subtitle}</p>
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

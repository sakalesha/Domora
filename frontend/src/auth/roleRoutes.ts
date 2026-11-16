import type { UserRole } from './types'

export function roleHomePath(role: UserRole): string {
  switch (role) {
    case 'resident':
      return '/resident'
    case 'vendor':
      return '/vendor'
    case 'ops':
      return '/ops'
  }
}

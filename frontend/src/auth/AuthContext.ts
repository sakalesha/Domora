import { createContext, type ReactNode } from 'react'

import type { SignupValues, UserProfile } from './types'

export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null }
  | { status: 'authenticated'; user: UserProfile }

export type CsrfState =
  | { status: 'loading'; token: null; message: null }
  | { status: 'ready'; token: string; message: null }
  | { status: 'error'; token: null; message: string }

export interface AuthContextValue {
  auth: AuthState
  csrf: CsrfState
  notice: string | null
  clearNotice: () => void
  refreshCsrf: () => Promise<string | null>
  signIn: (username: string, password: string) => Promise<UserProfile>
  signUp: (values: SignupValues) => Promise<UserProfile>
  signOut: () => Promise<void>
}

export interface AuthProviderProps {
  children: ReactNode
}

export const AuthContext = createContext<AuthContextValue | null>(null)

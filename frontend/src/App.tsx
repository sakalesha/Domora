import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { roleHomePath } from './auth/roleRoutes'
import type { UserRole } from './auth/types'
import { useAuth } from './auth/useAuth'
import { LoadingScreen } from './components/LoadingScreen'
import { LoginPage } from './pages/LoginPage'
import { RoleHomePage } from './pages/RoleHomePage'
import { SignupPage } from './pages/SignupPage'

import { WelcomePage } from './pages/WelcomePage'

interface PublicOnlyProps {
  children: ReactNode
}

interface RoleRouteProps {
  role: UserRole
}

function HomeRoute() {
  const { auth } = useAuth()
  if (auth.status === 'loading') {
    return <LoadingScreen />
  }
  if (auth.status === 'anonymous') {
    return <WelcomePage />
  }
  return <Navigate replace to={roleHomePath(auth.user.role)} />
}

function HomeRedirect() {
  const { auth } = useAuth()
  if (auth.status === 'loading') {
    return <LoadingScreen />
  }
  if (auth.status === 'anonymous') {
    return <Navigate replace to="/login" />
  }
  return <Navigate replace to={roleHomePath(auth.user.role)} />
}

function PublicOnly({ children }: PublicOnlyProps) {
  const { auth } = useAuth()
  if (auth.status === 'loading') {
    return <LoadingScreen />
  }
  if (auth.status === 'authenticated') {
    return <Navigate replace to={roleHomePath(auth.user.role)} />
  }
  return children
}

function ProtectedRole({ role }: RoleRouteProps) {
  const { auth } = useAuth()
  if (auth.status === 'loading') {
    return <LoadingScreen />
  }
  if (auth.status === 'anonymous') {
    return <Navigate replace to="/login" />
  }
  if (auth.user.role !== role) {
    return <Navigate replace to={roleHomePath(auth.user.role)} />
  }
  return <RoleHomePage />
}

function App() {
  return (
    <Routes>
      <Route element={<HomeRoute />} path="/" />
      <Route
        element={
          <PublicOnly>
            <WelcomePage />
          </PublicOnly>
        }
        path="/welcome"
      />
      <Route
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
        path="/login"
      />
      <Route
        element={
          <PublicOnly>
            <SignupPage />
          </PublicOnly>
        }
        path="/signup"
      />
      <Route element={<ProtectedRole role="resident" />} path="/resident" />
      <Route element={<ProtectedRole role="vendor" />} path="/vendor" />
      <Route element={<ProtectedRole role="ops" />} path="/ops" />
      <Route element={<HomeRedirect />} path="*" />
    </Routes>
  )
}

export default App

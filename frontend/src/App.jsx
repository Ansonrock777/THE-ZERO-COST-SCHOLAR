// frontend/src/App.jsx
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabaseClient'
import LoginPage from './components/Auth/LoginPage'
import SignupPage from './components/Auth/SignupPage'
import Dashboard from './components/Dashboard/Dashboard'
const DeveloperDashboard = lazy(() => import('./components/DeveloperDashboard'))

function RouteFallback({ label }) {
  return <div className='pdf-empty' style={{ minHeight: '100vh', alignItems: 'center' }}><p>{label}</p></div>
}

// Children may be a render prop, so a protected screen can receive the
// authenticated user without every screen having to reach for the session.
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <RouteFallback label='Loading…' />
  if (!user) return <Navigate to='/login' replace />
  return typeof children === 'function' ? children(user) : children
}

export default function App() {
  const signOut = () => supabase.auth.signOut()

  return (
    <BrowserRouter>
      <Routes>
        <Route path='/login' element={<LoginPage />} />
        <Route path='/signup' element={<SignupPage />} />
        <Route path='/dashboard' element={
          <ProtectedRoute>
            {user => <Dashboard user={user} onSignOut={signOut} />}
          </ProtectedRoute>
        } />
        <Route path='/developer' element={
          <ProtectedRoute>
            <Suspense fallback={<RouteFallback label='Loading diagnostics…' />}>
              <DeveloperDashboard />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path='*' element={<Navigate to='/dashboard' replace />} />
      </Routes>
    </BrowserRouter>
  )
}

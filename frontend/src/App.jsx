// frontend/src/App.jsx
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoginPage from './components/Auth/LoginPage'
import SignupPage from './components/Auth/SignupPage'
import Dashboard from './components/Dashboard/Dashboard'
const DeveloperDashboard = lazy(() => import('./components/DeveloperDashboard'))

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className='min-h-screen flex items-center justify-center'>Loading...</div>
  return user ? children : <Navigate to='/login' replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/login' element={<LoginPage />} />
        <Route path='/signup' element={<SignupPage />} />
        <Route path='/dashboard' element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
        <Route path='/developer' element={<ProtectedRoute><Suspense fallback={<div className='min-h-screen flex items-center justify-center'>Loading diagnostics…</div>}><DeveloperDashboard /></Suspense></ProtectedRoute>} />
        <Route path='*' element={<Navigate to='/dashboard' replace />} />
      </Routes>
    </BrowserRouter>
  )
}

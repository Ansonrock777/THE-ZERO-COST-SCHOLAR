// frontend/src/components/Auth/LoginPage.jsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else navigate('/dashboard')
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-slate-50'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <CardTitle className='text-2xl font-bold text-center'>
            The Zero-Cost Scholar
          </CardTitle>
          <p className='text-center text-slate-500 text-sm'>
            Sign in to access your private documents
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className='space-y-4'>
            <Input type='email' placeholder='Email' value={email}
              onChange={e => setEmail(e.target.value)} required />
            <Input type='password' placeholder='Password' value={password}
              onChange={e => setPassword(e.target.value)} required />
            {error && <p className='text-red-500 text-sm'>{error}</p>}
            <Button type='submit' className='w-full' disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <p className='text-center mt-4 text-sm'>
            No account? <Link to='/signup' className='text-blue-600 underline'>Sign up</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

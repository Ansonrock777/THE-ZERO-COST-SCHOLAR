// frontend/src/components/Auth/SignupPage.jsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true); setError(''); setMessage('')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message); setLoading(false)
    } else if (data.session) {
      navigate('/dashboard')
    } else {
      setMessage('Check your email to confirm your account.')
      setLoading(false)
    }
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-slate-50'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <CardTitle className='text-2xl font-bold text-center'>
            The Zero-Cost Scholar
          </CardTitle>
          <p className='text-center text-slate-500 text-sm'>
            Create an account to start asking your documents questions
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className='space-y-4'>
            <Input type='email' placeholder='Email' value={email}
              onChange={e => setEmail(e.target.value)} required />
            <Input type='password' placeholder='Password (min 6 characters)' value={password}
              onChange={e => setPassword(e.target.value)} minLength={6} required />
            {error && <p className='text-red-500 text-sm'>{error}</p>}
            {message && <p className='text-green-600 text-sm'>{message}</p>}
            <Button type='submit' className='w-full' disabled={loading}>
              {loading ? 'Creating account...' : 'Sign Up'}
            </Button>
          </form>
          <p className='text-center mt-4 text-sm'>
            Already have an account? <Link to='/login' className='text-blue-600 underline'>Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// frontend/src/components/Auth/AuthPage.jsx
// The single sign-in / sign-up screen: a dark colophon plate carrying the
// brand and the promise, beside a quiet form column. `/login` and `/signup`
// both render this — the route only seeds which mode opens first, and the
// segmented control switches between them in place.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen, Lock, Mail, Quote, ShieldCheck, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import ReadingDeskPlate from './ReadingDeskPlate'

const COPY = {
  signin: {
    title: 'Sign in',
    subtitle: 'Access your private documents and past inquiries.',
    passwordPlaceholder: 'Your password',
    submit: 'Sign in',
    loading: 'Signing in…',
    footNote: 'No account yet?',
    footLink: 'Sign up',
  },
  signup: {
    title: 'Create your account',
    subtitle: 'Start asking your documents questions in minutes.',
    passwordPlaceholder: 'Create a password',
    submit: 'Sign up',
    loading: 'Creating account…',
    footNote: 'Already have an account?',
    footLink: 'Sign in',
  },
}

// The three promises that close the form column. They are the same claims the
// colophon plate makes on the left, restated small — the page should answer
// "what am I signing into?" without the reader scrolling or guessing.
const ASSURANCES = [
  { Icon: ShieldCheck, text: 'Your documents stay private to your account.' },
  { Icon: Quote, text: 'Every answer cites the page it came from.' },
  { Icon: Sparkles, text: 'Free to start — no card required.' },
]

export default function AuthPage({ initialMode = 'signin' }) {
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  const copy = COPY[mode]
  const isSignin = mode === 'signin'

  const selectMode = (nextMode) => {
    setMode(nextMode)
    setError('')
    setMessage('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!isSignin && password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    setError('')
    setMessage('')

    if (isSignin) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }
      navigate('/dashboard')
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
    } else if (data.session) {
      navigate('/dashboard')
    } else {
      setMessage('Check your email to confirm your account.')
      setLoading(false)
    }
  }

  return (
    <div className='auth-page'>
      <aside className='auth-aside'>
        <span className='auth-numeral' aria-hidden='true'>01</span>

        <div className='auth-brand'>
          <span className='auth-brand-mark' aria-hidden='true'><BookOpen size={19} strokeWidth={1.7} /></span>
          <span className='auth-brand-name'>The Zero-Cost Scholar</span>
        </div>

        <div className='auth-lede'>
          <span className='kicker'>Evidence-grounded research</span>
          <h1>Read closely.<br />Ask confidently.</h1>
          <p>
            Every answer stays tethered to its source — hybrid semantic and lexical retrieval,
            with citations that open the exact page they came from.
          </p>
        </div>

        <figure className='auth-plate'>
          <ReadingDeskPlate />
          <figcaption>Plate I — the reading desk</figcaption>
        </figure>
      </aside>

      <main className='auth-panel'>
        <div className='auth-form-wrap'>
          <div className='seg' role='radiogroup' aria-label='Account mode'>
            <label className='seg-opt'>
              <input type='radio' name='auth-mode' value='signin' checked={isSignin} onChange={() => selectMode('signin')} />
              <span>Sign in</span>
            </label>
            <label className='seg-opt'>
              <input type='radio' name='auth-mode' value='signup' checked={!isSignin} onChange={() => selectMode('signup')} />
              <span>Sign up</span>
            </label>
          </div>

          <div className='auth-heading'>
            <h1>{copy.title}</h1>
            <p>{copy.subtitle}</p>
          </div>

          <form className='auth-form' onSubmit={handleSubmit}>
            <div className='field'>
              <label htmlFor='auth-email'>Email</label>
              <div className='field-control'>
                <input
                  className='input'
                  id='auth-email'
                  type='email'
                  autoComplete='email'
                  placeholder='you@example.com'
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  required
                />
                <Mail className='field-icon' size={16} strokeWidth={1.6} aria-hidden='true' />
              </div>
            </div>
            <div className='field'>
              <label htmlFor='auth-password'>Password</label>
              <div className='field-control'>
                <input
                  className='input'
                  id='auth-password'
                  type='password'
                  autoComplete={isSignin ? 'current-password' : 'new-password'}
                  minLength={isSignin ? undefined : 6}
                  placeholder={copy.passwordPlaceholder}
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  required
                />
                <Lock className='field-icon' size={16} strokeWidth={1.6} aria-hidden='true' />
              </div>
              {!isSignin && <p className='field-hint'>At least 6 characters.</p>}
            </div>

            {error && <p className='auth-note is-error' role='alert'>{error}</p>}
            {message && <p className='auth-note is-message' role='status'>{message}</p>}

            <button type='submit' className='btn btn-primary btn-block' disabled={loading}>
              {loading ? copy.loading : <>{copy.submit}<ArrowRight size={15} strokeWidth={2} /></>}
            </button>
          </form>

          <p className='auth-foot'>
            {copy.footNote}{' '}
            <button type='button' onClick={() => selectMode(isSignin ? 'signup' : 'signin')}>{copy.footLink}</button>
          </p>

          <ul className='auth-assurances'>
            {ASSURANCES.map(({ Icon, text }) => (
              <li key={text}>
                <Icon size={15} strokeWidth={1.6} aria-hidden='true' />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  )
}

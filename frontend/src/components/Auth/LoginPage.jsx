// frontend/src/components/Auth/LoginPage.jsx
// `/login` opens the shared auth screen in sign-in mode.
import AuthPage from './AuthPage'

export default function LoginPage() {
  return <AuthPage initialMode='signin' />
}

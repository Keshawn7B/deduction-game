import {
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from 'firebase/auth'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { auth } from '../firebase/client'

type AuthContextValue = {
  user: User | null
  loading: boolean
  error: string
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (nextUser) {
        setUser(nextUser)
        setError('')
        setLoading(false)
        return
      }

      try {
        const credential = await signInAnonymously(auth)
        setUser(credential.user)
        setError('')
      } catch (error) {
        console.error('Anonymous sign-in failed:', error)
        setError(
          error instanceof Error ? error.message : 'Anonymous sign-in failed.',
        )
      } finally {
        setLoading(false)
      }
    })

    return unsubscribe
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
    }),
    [user, loading, error],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.')
  }

  return value
}

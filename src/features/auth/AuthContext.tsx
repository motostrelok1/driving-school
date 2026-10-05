import {
  createContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import { clearOneSignalUser, identifyOneSignalUser } from '@/lib/onesignal'
import type { Profile, UserRole } from '@/types'
import type { User, Session } from '@supabase/supabase-js'

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  session: Session | null
  role: UserRole | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null; role?: UserRole | null }>
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: Error | null }>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export { AuthContext }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (!active) return
      if (error) {
        console.error('Error restoring session:', error)
        setSession(null)
        setUser(null)
        setProfile(null)
        setIsLoading(false)
        return
      }
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        await fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setIsLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') return
      setSession(session)
      setUser(session?.user ?? null)
      if (!session?.user) {
        setProfile(null)
        setIsLoading(false)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user) return
    void identifyOneSignalUser(user.id)
  }, [user])

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
    }
    setProfile(data as Profile | null)
    setIsLoading(false)
  }

  async function signIn(email: string, password: string) {
    setIsLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setIsLoading(false)
      return { error }
    }

    setSession(data.session)
    setUser(data.user)
    await fetchProfile(data.user.id)

    const { data: freshProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    return { error: null, role: (freshProfile?.role as UserRole | undefined) ?? null }
  }

  async function signUp(
    email: string,
    password: string,
    fullName: string,
    phone: string
  ) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
        },
      },
    })

    return { error }
  }

  async function resetPassword(email: string) {
    const normalizedEmail = email.trim()
    const { data: emailExists, error: lookupError } = await supabase.rpc(
      'account_email_exists',
      { email_to_check: normalizedEmail }
    )

    if (lookupError) {
      return { error: lookupError }
    }

    if (!emailExists) {
      return { error: new Error('Такая почта отсутствует.') }
    }

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  async function signOut() {
    const oneSignalLogout = clearOneSignalUser()
    const { error } = await supabase.auth.signOut({ scope: 'local' })

    if (error) {
      console.error('Error signing out:', error)
      throw error
    }

    setSession(null)
    setUser(null)
    setProfile(null)
    setIsLoading(false)

    void oneSignalLogout
  }

  const value: AuthContextValue = {
    user,
    profile,
    session,
    role: profile?.role ?? null,
    isLoading,
    signIn,
    signUp,
    resetPassword,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}


import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { GraduationCap, Eye, EyeOff } from 'lucide-react'

function getAuthErrorMessage(message: string) {
  if (message === 'Invalid login credentials') {
    return 'Неверный логин или пароль.'
  }

  return message
}

export function LoginPage() {
  const navigate = useNavigate()
  const { signIn, resetPassword, user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isResetMode, setIsResetMode] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  if (user) {
    navigate('/', { replace: true })
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    setIsLoading(true)

    if (isResetMode) {
      const { error } = await resetPassword(email)

      if (error) {
        setError(getAuthErrorMessage(error.message))
        setIsLoading(false)
        return
      }

      setSuccessMessage('Письмо для восстановления пароля отправлено на указанную почту.')
      setIsLoading(false)
      return
    }

    const { error } = await signIn(email, password)

    if (error) {
      setError(getAuthErrorMessage(error.message))
      setIsLoading(false)
      return
    }

    navigate('/')
  }

  function toggleResetMode() {
    setIsResetMode((value) => !value)
    setPassword('')
    setShowPassword(false)
    setError('')
    setSuccessMessage('')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <GraduationCap className="h-7 w-7 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Вход в Автошколу</CardTitle>
          <p className="text-sm text-muted-foreground">
            {isResetMode
              ? 'Введите email, и мы отправим ссылку для восстановления пароля'
              : 'Введите email и пароль для входа'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              name={isResetMode ? 'reset-email' : 'login-email'}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />

            {!isResetMode ? (
              <div className="relative">
                <Input
                  label="Пароль"
                  name="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[34px] text-muted-foreground hover:text-primary"
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            ) : null}

            {error ? (
              <p className="rounded-lg bg-danger/10 p-3 text-center text-sm text-danger">
                {error}
              </p>
            ) : null}

            {successMessage ? (
              <p className="rounded-lg bg-success/10 p-3 text-center text-sm text-success">
                {successMessage}
              </p>
            ) : null}

            <Button type="submit" className="w-full" isLoading={isLoading}>
              {isResetMode ? 'Восстановить пароль' : 'Войти'}
            </Button>
          </form>

          <button
            type="button"
            onClick={toggleResetMode}
            className="mt-3 w-full text-center text-sm font-medium text-secondary hover:underline"
          >
            {isResetMode ? 'Вернуться ко входу' : 'Забыли пароль?'}
          </button>

          <p className="mt-3 text-center text-sm text-muted-foreground">
            Нет аккаунта?{' '}
            <Link
              to="/register"
              className="font-medium text-secondary hover:underline"
            >
              Зарегистрироваться
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { GraduationCap, Eye, EyeOff } from 'lucide-react'

type RegisterFieldErrors = {
  fullName?: string
  email?: string
  password?: string
}

function getRegisterErrorMessage(message: string) {
  if (message === 'Unable to validate email address: invalid format') {
    return 'Неверный формат email.'
  }

  if (message.toLowerCase().includes('email rate limit exceeded')) {
    return 'Превышен лимит отправки писем. Попробуйте позже.'
  }

  return message
}

export function RegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signUp, user } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({})
  const [error, setError] = useState('')
  const [confirmationMessage, setConfirmationMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setFullName('')
    setEmail('')
    setPassword('')
    setShowPassword(false)
    setFieldErrors({})
    setError('')
    setConfirmationMessage('')
    setIsLoading(false)
  }, [location.key])

  if (user) {
    navigate('/', { replace: true })
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submitRegistration()
  }

  async function submitRegistration() {
    setError('')
    setConfirmationMessage('')

    const nextFieldErrors: RegisterFieldErrors = {}

    if (!fullName.trim()) {
      nextFieldErrors.fullName = 'Заполните ФИО.'
    }

    if (!email.trim()) {
      nextFieldErrors.email = 'Заполните email.'
    }

    if (!password.trim()) {
      nextFieldErrors.password = 'Заполните пароль.'
    }

    setFieldErrors(nextFieldErrors)

    if (Object.keys(nextFieldErrors).length > 0) {
      return
    }

    setIsLoading(true)

    const { error } = await signUp(email.trim(), password, fullName.trim())

    if (error) {
      setError(getRegisterErrorMessage(error.message))
      setIsLoading(false)
      return
    }

    setConfirmationMessage(
      'На указанный email отправлено письмо. Подтвердите почту, чтобы завершить регистрацию.'
    )
    setFullName('')
    setEmail('')
    setPassword('')
    setShowPassword(false)
    setIsLoading(false)
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
          <CardTitle className="text-2xl">Регистрация</CardTitle>
          <p className="text-sm text-muted-foreground">
            Создайте аккаунт ученика
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit}
            className="space-y-4"
            autoComplete="off"
            noValidate
          >
            <Input
              label="ФИО"
              name="register-full-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Иванов Иван Иванович"
              autoComplete="off"
              error={fieldErrors.fullName}
              required
            />
            <Input
              label="Email"
              name="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="off"
              error={fieldErrors.email}
              required
            />
            <div className="relative">
              <Input
                label="Пароль"
                name="register-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                error={fieldErrors.password}
                required
                minLength={6}
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

            {error ? (
              <p className="rounded-lg bg-danger/10 p-3 text-center text-sm text-danger">
                {error}
              </p>
            ) : null}

            {confirmationMessage ? (
              <p className="rounded-lg bg-danger/10 p-3 text-center text-sm font-medium text-danger">
                {confirmationMessage}
              </p>
            ) : null}

            <Button
              type="button"
              className="w-full"
              isLoading={isLoading}
              onClick={submitRegistration}
            >
              Зарегистрироваться
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Уже есть аккаунт?{' '}
            <Link
              to="/login"
              className="font-medium text-secondary hover:underline"
            >
              Войти
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

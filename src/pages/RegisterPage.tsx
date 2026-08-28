import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { GraduationCap, Eye, EyeOff } from 'lucide-react'

type RegisterFieldErrors = {
  lastName?: string
  firstName?: string
  middleName?: string
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
  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({})
  const [error, setError] = useState('')
  const [confirmationMessage, setConfirmationMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setLastName('')
    setFirstName('')
    setMiddleName('')
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

    if (!lastName.trim()) {
      nextFieldErrors.lastName = 'Заполните фамилию.'
    }

    if (!firstName.trim()) {
      nextFieldErrors.firstName = 'Заполните имя.'
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

    const fullName = [lastName, firstName, middleName]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' ')

    const { error } = await signUp(email.trim(), password, fullName)

    if (error) {
      setError(getRegisterErrorMessage(error.message))
      setIsLoading(false)
      return
    }

    setConfirmationMessage(
      'На указанный email отправлено письмо. Подтвердите почту, чтобы завершить регистрацию.'
    )
    setLastName('')
    setFirstName('')
    setMiddleName('')
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
              label="Фамилия"
              name="register-last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Иванов"
              autoComplete="family-name"
              error={fieldErrors.lastName}
              required
            />
            <Input
              label="Имя"
              name="register-first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Иван"
              autoComplete="given-name"
              error={fieldErrors.firstName}
              required
            />
            <Input
              label="Отчество"
              name="register-middle-name"
              type="text"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              placeholder="Иванович"
              autoComplete="additional-name"
              error={fieldErrors.middleName}
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

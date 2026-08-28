import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { GraduationCap, Eye, EyeOff } from 'lucide-react'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [passwordRepeat, setPasswordRepeat] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccessMessage('')

    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов.')
      return
    }

    if (password !== passwordRepeat) {
      setError('Пароли не совпадают.')
      return
    }

    setIsLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setIsLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccessMessage('Пароль обновлен. Теперь можно войти.')
    setTimeout(() => navigate('/login', { replace: true }), 1200)
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
          <CardTitle className="text-2xl">Новый пароль</CardTitle>
          <p className="text-sm text-muted-foreground">
            Введите новый пароль для входа в приложение
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                label="Новый пароль"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
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
            <Input
              label="Повторите пароль"
              type={showPassword ? 'text' : 'password'}
              value={passwordRepeat}
              onChange={(e) => setPasswordRepeat(e.target.value)}
              autoComplete="new-password"
              required
            />

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
              Сохранить пароль
            </Button>
          </form>

          <Link
            to="/login"
            className="mt-3 block text-center text-sm font-medium text-secondary hover:underline"
          >
            Вернуться ко входу
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

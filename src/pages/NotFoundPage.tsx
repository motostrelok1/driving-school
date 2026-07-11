import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4 text-center">
      <h1 className="text-6xl font-bold text-primary">404</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Страница не найдена
      </p>
      <Link to="/" className="mt-6">
        <Button>На главную</Button>
      </Link>
    </div>
  )
}

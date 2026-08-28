import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { NotificationButton } from '@/components/NotificationButton'
import {
  GraduationCap,
  Calendar,
  Users,
  Shield,
  LogOut,
  Menu,
  X,
  User,
  Car,
  BookOpen,
  CreditCard,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { cn } from '@/utils/cn'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles: Array<'student' | 'instructor' | 'admin'>
}

const navItems: NavItem[] = [
  {
    label: 'Профиль',
    href: '/student/profile',
    icon: User,
    roles: ['student'],
  },
  {
    label: 'Вождение',
    href: '/student/practice',
    icon: Car,
    roles: ['student'],
  },
  {
    label: 'Теория',
    href: '/student/theory',
    icon: BookOpen,
    roles: ['student'],
  },
  {
    label: 'Расчеты',
    href: '/student/payment',
    icon: CreditCard,
    roles: ['student'],
  },
  {
    label: 'Моё расписание',
    href: '/instructor/schedule',
    icon: Calendar,
    roles: ['instructor'],
  },
  {
    label: 'Мои ученики',
    href: '/instructor/students',
    icon: GraduationCap,
    roles: ['instructor'],
  },
  {
    label: 'Панель управления',
    href: '/admin',
    icon: Shield,
    roles: ['admin'],
  },
  {
    label: 'Расписание',
    href: '/admin/schedule',
    icon: Calendar,
    roles: ['admin'],
  },
  {
    label: 'Пользователи',
    href: '/admin/users',
    icon: Users,
    roles: ['admin'],
  },
  {
    label: 'ПДД',
    href: '/admin/pdd',
    icon: BookOpen,
    roles: ['admin'],
  },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const { profile, role, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const visibleNav = navItems.filter(
    (item) => role && item.roles.includes(role)
  )

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted sm:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
            <Link
              to="/"
              className="flex items-center gap-2 font-semibold text-primary"
            >
              <GraduationCap className="h-6 w-6 text-secondary" />
              <span>Автошкола</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <NotificationButton />
            {profile ? (
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {profile.full_name || profile.id.slice(0, 8)}
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="hidden sm:inline-flex"
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              Выйти
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-6 px-4 py-6">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-20 w-64 transform border-r border-border bg-white p-4 pt-20 transition-transform sm:static sm:translate-x-0 sm:border-none sm:bg-transparent sm:p-0 sm:pt-0',
            isMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <nav className="flex flex-col gap-1">
            {visibleNav.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-primary'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="mt-4 justify-start sm:hidden"
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              Выйти
            </Button>
          </nav>
        </aside>

        {isMenuOpen ? (
          <div
            className="fixed inset-0 z-10 bg-black/20 sm:hidden"
            onClick={() => setIsMenuOpen(false)}
          />
        ) : null}

        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}

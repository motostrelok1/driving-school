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
  MessageSquare,
  ListTodo,
  UsersRound,
  PanelLeftClose,
  PanelLeftOpen,
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
    label: 'Переписка',
    href: '/student/messages',
    icon: MessageSquare,
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
    label: 'Группы',
    href: '/admin/groups',
    icon: UsersRound,
    roles: ['admin'],
  },
  {
    label: 'Переписка',
    href: '/admin/messages',
    icon: MessageSquare,
    roles: ['admin'],
  },
  {
    label: 'Задачи',
    href: '/admin/tasks',
    icon: ListTodo,
    roles: ['admin'],
  },
  {
    label: 'ПДД',
    href: '/admin/pdd',
    icon: BookOpen,
    roles: ['admin'],
  },
  {
    label: 'Банк вопросов',
    href: '/admin/theory-bank',
    icon: BookOpen,
    roles: ['admin'],
  },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const { profile, role, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isAdminSidebarCollapsed, setIsAdminSidebarCollapsed] = useState(false)
  const isAdmin = role === 'admin'

  const visibleNav = navItems.filter((item) => {
    if (!role || !item.roles.includes(role)) return false
    if (item.href === '/student/practice' && role === 'student') {
      return Boolean(profile?.driving_enabled)
    }
    return true
  })

  async function handleSignOut() {
    if (isSigningOut) return
    setIsSigningOut(true)
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
        <div className={cn(
          'mx-auto flex h-14 w-full items-center justify-between px-4',
          isAdmin ? 'max-w-none' : 'max-w-5xl'
        )}>
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
              isLoading={isSigningOut}
              disabled={isSigningOut}
              className="hidden sm:inline-flex"
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              Выйти
            </Button>
          </div>
        </div>
      </header>

      <div className={cn(
        'mx-auto flex w-full flex-1 px-4 py-6',
        isAdmin ? 'max-w-none gap-4' : 'max-w-5xl gap-6'
      )}>
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-20 w-64 transform border-r border-border bg-white p-4 pt-20 transition-all sm:static sm:translate-x-0 sm:border-none sm:bg-transparent sm:p-0 sm:pt-0',
            isMenuOpen ? 'translate-x-0' : '-translate-x-full',
            isAdmin && isAdminSidebarCollapsed ? 'sm:w-14' : 'sm:w-56'
          )}
        >
          {isAdmin ? (
            <div className="mb-2 hidden sm:flex sm:justify-end">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white text-muted-foreground hover:bg-muted hover:text-primary"
                onClick={() => setIsAdminSidebarCollapsed((value) => !value)}
                aria-label={isAdminSidebarCollapsed ? 'Показать меню' : 'Скрыть меню'}
                title={isAdminSidebarCollapsed ? 'Показать меню' : 'Скрыть меню'}
              >
                {isAdminSidebarCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
            </div>
          ) : null}

          <nav className="flex flex-col gap-1">
            {visibleNav.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isAdmin && isAdminSidebarCollapsed ? 'justify-center gap-0' : 'gap-3',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-primary'
                  )}
                  title={isAdmin && isAdminSidebarCollapsed ? item.label : undefined}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!(isAdmin && isAdminSidebarCollapsed) ? item.label : null}
                </Link>
              )
            })}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              isLoading={isSigningOut}
              disabled={isSigningOut}
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

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}

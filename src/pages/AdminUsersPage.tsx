import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  useAllUsers,
  useUpdateProfile,
  useInstructors,
  useAssignInstructor,
  useDeleteProfile,
  useCreateUser,
  useSendPasswordReset,
  useStudentFinance,
  useUpsertStudentFinance,
} from '@/features/admin/useAdmin'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/hooks/useAuth'
import type { Profile, UserRole } from '@/types'
import {
  CalendarDays,
  ChevronDown,
  DollarSign,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCog,
  X,
} from 'lucide-react'

const roleLabels: Record<UserRole, string> = {
  student: 'Ученик',
  instructor: 'Инструктор',
  admin: 'Администратор',
}

type UserFilterField = 'role' | 'full_name'
type RoleFilterValue = UserRole | 'all'

function generatePassword() {
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*'
  const bytes = crypto.getRandomValues(new Uint32Array(12))
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('')
}

function getAdminAuthErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase()

  if (normalizedMessage.includes('email address') && normalizedMessage.includes('invalid')) {
    return 'Некорректный адрес электронной почты.'
  }

  if (normalizedMessage.includes('user already registered')) {
    return 'Пользователь с такой почтой уже зарегистрирован.'
  }

  if (normalizedMessage.includes('password')) {
    return 'Проверьте пароль: он должен быть не короче 6 символов.'
  }

  if (normalizedMessage.includes('rate limit')) {
    return 'Слишком много запросов. Попробуйте позже.'
  }

  return message
}

export function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const { data: users, isLoading } = useAllUsers()
  const { data: instructors } = useInstructors()
  const updateProfile = useUpdateProfile()
  const assignInstructor = useAssignInstructor()
  const deleteProfile = useDeleteProfile()
  const createUser = useCreateUser()
  const sendPasswordReset = useSendPasswordReset()
  const upsertStudentFinance = useUpsertStudentFinance()
  const [search, setSearch] = useState('')
  const [filterBy, setFilterBy] = useState<UserFilterField>('role')
  const [roleFilter, setRoleFilter] = useState<RoleFilterValue>('all')
  const [editing, setEditing] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<UserRole>('student')
  const [selectedInstructor, setSelectedInstructor] = useState('')
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [assignErrorByStudentId, setAssignErrorByStudentId] = useState<
    Record<string, string>
  >({})
  const [expandedUserIds, setExpandedUserIds] = useState<string[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createFullName, setCreateFullName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRole, setCreateRole] = useState<UserRole>('student')
  const [createError, setCreateError] = useState<string | null>(null)
  const [userToResetPassword, setUserToResetPassword] = useState<Profile | null>(null)
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null)
  const [userToEditProfile, setUserToEditProfile] = useState<Profile | null>(null)
  const [profileFullName, setProfileFullName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [profileRole, setProfileRole] = useState<UserRole>('student')
  const [instructorPhotoUrl, setInstructorPhotoUrl] = useState('')
  const [instructorAge, setInstructorAge] = useState('')
  const [instructorRating, setInstructorRating] = useState('')
  const [instructorCar, setInstructorCar] = useState('')
  const [instructorCarYear, setInstructorCarYear] = useState('')
  const [instructorCarPhotoUrl, setInstructorCarPhotoUrl] = useState('')
  const [instructorReviewsRating, setInstructorReviewsRating] = useState('')
  const [instructorReviewText, setInstructorReviewText] = useState('')
  const [profileEditError, setProfileEditError] = useState<string | null>(null)
  const [userToEditFinance, setUserToEditFinance] = useState<Profile | null>(null)
  const [contractAmount, setContractAmount] = useState('')
  const [paymentDueDate, setPaymentDueDate] = useState('')
  const [installmentDueDate, setInstallmentDueDate] = useState('')
  const [financeError, setFinanceError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const { data: selectedFinance } = useStudentFinance(userToEditFinance?.id)

  useEffect(() => {
    if (!userToEditFinance) return

    setContractAmount(
      selectedFinance ? String(selectedFinance.contract_amount) : ''
    )
    setPaymentDueDate(selectedFinance?.payment_due_date ?? '')
    setInstallmentDueDate(selectedFinance?.installment_due_date ?? '')
  }, [selectedFinance, userToEditFinance])

  const filteredUsers =
    users?.filter((user) => {
      if (filterBy === 'role') {
        return roleFilter === 'all' || user.role === roleFilter
      }

      return (user.full_name || '').toLowerCase().includes(search.toLowerCase())
    }) ?? []

  function startEdit(user: Profile) {
    setEditing(user.id)
    setSelectedRole(user.role)
  }

  function toggleExpanded(userId: string) {
    setExpandedUserIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    )
  }

  function saveRole(userId: string) {
    updateProfile.mutate({ id: userId, updates: { role: selectedRole } })
    setEditing(null)
  }

  function handleAssignInstructor(studentId: string) {
    if (!selectedInstructor) return
    setAssignErrorByStudentId((current) => {
      const next = { ...current }
      delete next[studentId]
      return next
    })
    assignInstructor.mutate(
      {
        instructorId: selectedInstructor,
        studentId,
      },
      {
        onSuccess: () => {
          setSelectedInstructor('')
          setToastMessage('Инструктор назначен.')
        },
        onError: (error) =>
          setAssignErrorByStudentId((current) => ({
            ...current,
            [studentId]: error.message.includes('duplicate key')
              ? 'Этот инструктор уже назначен ученику.'
              : error.message,
          })),
      }
    )
  }

  function confirmDelete() {
    if (!userToDelete) return
    setDeleteError(null)
    deleteProfile.mutate(userToDelete.id, {
      onSuccess: () => setUserToDelete(null),
      onError: (error) => setDeleteError(error.message),
    })
  }

  function resetCreateForm() {
    setIsCreateOpen(false)
    setCreateFullName('')
    setCreateEmail('')
    setCreatePassword('')
    setCreateRole('student')
    setCreateError(null)
  }

  function closeCreateModal() {
    if (createUser.isPending) return
    resetCreateForm()
  }

  function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateError(null)

    if (!createFullName.trim() || !createEmail.trim() || createPassword.length < 6) {
      setCreateError('Заполните ФИО, email и пароль не короче 6 символов.')
      return
    }

    createUser.mutate(
      {
        email: createEmail.trim(),
        password: createPassword,
        fullName: createFullName.trim(),
        role: createRole,
      },
      {
        onSuccess: () => resetCreateForm(),
        onError: (error) => setCreateError(getAdminAuthErrorMessage(error.message)),
      }
    )
  }

  function confirmPasswordReset() {
    if (!userToResetPassword?.email) {
      setResetPasswordError('У пользователя не указан email.')
      return
    }

    setResetPasswordError(null)
    sendPasswordReset.mutate(userToResetPassword.email, {
      onSuccess: () => {
        setUserToResetPassword(null)
        setToastMessage('Письмо для сброса пароля отправлено.')
      },
      onError: (error) =>
        setResetPasswordError(getAdminAuthErrorMessage(error.message)),
    })
  }

  function openProfileEdit(user: Profile) {
    setUserToEditProfile(user)
    setProfileFullName(user.full_name || '')
    setProfileEmail(user.email || '')
    setProfilePhone(user.phone || '')
    setProfileRole(user.role)
    setInstructorPhotoUrl(user.instructor_photo_url || '')
    setInstructorAge(user.instructor_age ? String(user.instructor_age) : '')
    setInstructorRating(user.instructor_rating ? String(user.instructor_rating) : '')
    setInstructorCar(user.instructor_car || '')
    setInstructorCarYear(user.instructor_car_year ? String(user.instructor_car_year) : '')
    setInstructorCarPhotoUrl(user.instructor_car_photo_url || '')
    setInstructorReviewsRating(user.instructor_reviews_rating ? String(user.instructor_reviews_rating) : '')
    setInstructorReviewText(user.instructor_review_text || '')
    setProfileEditError(null)
  }

  function closeProfileEdit() {
    if (updateProfile.isPending) return
    setUserToEditProfile(null)
    setProfileFullName('')
    setProfileEmail('')
    setProfilePhone('')
    setProfileRole('student')
    setInstructorPhotoUrl('')
    setInstructorAge('')
    setInstructorRating('')
    setInstructorCar('')
    setInstructorCarYear('')
    setInstructorCarPhotoUrl('')
    setInstructorReviewsRating('')
    setInstructorReviewText('')
    setProfileEditError(null)
  }

  function handleProfileEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!userToEditProfile) return

    setProfileEditError(null)

    if (!profileFullName.trim()) {
      setProfileEditError('Заполните ФИО.')
      return
    }

    if (profileEmail.trim() && !profileEmail.includes('@')) {
      setProfileEditError('Некорректный адрес электронной почты.')
      return
    }

    const parsedInstructorAge = instructorAge ? Number(instructorAge) : null
    const parsedInstructorRating = instructorRating ? Number(instructorRating) : null
    const parsedInstructorCarYear = instructorCarYear ? Number(instructorCarYear) : null
    const parsedInstructorReviewsRating = instructorReviewsRating ? Number(instructorReviewsRating) : null

    updateProfile.mutate(
      {
        id: userToEditProfile.id,
        updates: {
          full_name: profileFullName.trim(),
          email: profileEmail.trim() || null,
          phone: profilePhone.trim() || null,
          role: profileRole,
          instructor_photo_url: profileRole === 'instructor' ? instructorPhotoUrl.trim() || null : null,
          instructor_age: profileRole === 'instructor' ? parsedInstructorAge : null,
          instructor_rating: profileRole === 'instructor' ? parsedInstructorRating : null,
          instructor_car: profileRole === 'instructor' ? instructorCar.trim() || null : null,
          instructor_car_year: profileRole === 'instructor' ? parsedInstructorCarYear : null,
          instructor_car_photo_url: profileRole === 'instructor' ? instructorCarPhotoUrl.trim() || null : null,
          instructor_reviews_rating: profileRole === 'instructor' ? parsedInstructorReviewsRating : null,
          instructor_review_text: profileRole === 'instructor' ? instructorReviewText.trim() || null : null,
        },
      },
      {
        onSuccess: () => {
          closeProfileEdit()
          setToastMessage('Данные пользователя обновлены.')
        },
        onError: (error) =>
          setProfileEditError(getAdminAuthErrorMessage(error.message)),
      }
    )
  }

  function openFinanceEdit(user: Profile) {
    setUserToEditFinance(user)
    setContractAmount('')
    setPaymentDueDate('')
    setInstallmentDueDate('')
    setFinanceError(null)
  }

  function closeFinanceEdit() {
    if (upsertStudentFinance.isPending) return
    setUserToEditFinance(null)
    setContractAmount('')
    setPaymentDueDate('')
    setInstallmentDueDate('')
    setFinanceError(null)
  }

  function handleFinanceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!userToEditFinance) return

    const amount = Number(contractAmount)
    if (!Number.isFinite(amount) || amount < 0) {
      setFinanceError('Введите корректную сумму договора.')
      return
    }

    setFinanceError(null)
    upsertStudentFinance.mutate(
      {
        studentId: userToEditFinance.id,
        contractAmount: amount,
        paymentDueDate: paymentDueDate || null,
        installmentDueDate: installmentDueDate || null,
      },
      {
        onSuccess: () => {
          closeFinanceEdit()
          setToastMessage('Расчеты ученика обновлены.')
        },
        onError: (error) => setFinanceError(error.message),
      }
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Пользователи</h1>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Список пользователей</CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-12 border-sky-200 bg-sky-50 px-0 text-sky-700 hover:bg-sky-100"
            aria-label="Добавить пользователя"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <select
              value={filterBy}
              onChange={(e) => {
                setFilterBy(e.target.value as UserFilterField)
                setSearch('')
                setRoleFilter('all')
              }}
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-primary sm:w-48"
            >
              <option value="role">Роль</option>
              <option value="full_name">ФИО</option>
            </select>

            {filterBy === 'role' ? (
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as RoleFilterValue)}
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-primary sm:flex-1"
              >
                <option value="all">Все роли</option>
                <option value="student">Ученик</option>
                <option value="instructor">Инструктор</option>
                <option value="admin">Администратор</option>
              </select>
            ) : (
              <Input
                placeholder="Поиск по ФИО"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="h-4 w-4" />}
              />
            )}
          </div>

          <div className="space-y-3">
            {filteredUsers.map((user) => {
              const isExpanded = expandedUserIds.includes(user.id)
              const isCurrentAdmin =
                user.id === currentUser?.id && user.role === 'admin'

              return (
                <div
                  key={user.id}
                  className="min-w-0 rounded-lg border border-border"
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted"
                    aria-expanded={isExpanded}
                    onClick={() => toggleExpanded(user.id)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-primary">
                        {user.full_name || 'Без имени'}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant={isCurrentAdmin ? 'danger' : 'secondary'}>
                        {roleLabels[user.role]}
                      </Badge>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </span>
                  </button>

                  {isExpanded ? (
                    <div className="border-t border-border p-3">
                      <div className="mb-3 min-w-0">
                        <p className="break-all text-sm text-muted-foreground">
                          {user.email || 'Email не указан'}
                        </p>
                        <p className="break-all text-xs text-muted-foreground">
                          {user.id}
                        </p>
                      </div>

                      {editing === user.id ? (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <select
                            value={selectedRole}
                            onChange={(e) =>
                              setSelectedRole(e.target.value as UserRole)
                            }
                            className="h-10 w-full rounded-lg border border-border px-3 sm:w-auto"
                          >
                            <option value="student">Ученик</option>
                            <option value="instructor">Инструктор</option>
                            <option value="admin">Администратор</option>
                          </select>
                          <Button size="sm" onClick={() => saveRole(user.id)}>
                            Сохранить
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditing(null)}
                          >
                            Отмена
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(user)}
                          >
                            <UserCog className="mr-1.5 h-4 w-4" />
                            Изменить роль
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!user.email}
                            onClick={() => {
                              setResetPasswordError(null)
                              setUserToResetPassword(user)
                            }}
                          >
                            <KeyRound className="mr-1.5 h-4 w-4" />
                            Сбросить пароль
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 bg-white text-red-800 hover:bg-red-100"
                            aria-label="Удалить пользователя"
                            onClick={() => {
                              setDeleteError(null)
                              setUserToDelete(user)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label="Изменить данные пользователя"
                            onClick={() => openProfileEdit(user)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {user.role === 'student' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label="Расчеты ученика"
                              onClick={() => openFinanceEdit(user)}
                            >
                              <DollarSign className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {user.role === 'instructor' ? (
                            <Link
                              to={`/admin/schedule?instructor=${user.id}`}
                              className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-white px-3 text-sm font-medium text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <CalendarDays className="mr-1.5 h-4 w-4" />
                              Расписание
                            </Link>
                          ) : null}
                        </div>
                      )}

                      {user.role === 'student' && instructors ? (
                        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center">
                          <select
                            value={selectedInstructor}
                            onChange={(e) => setSelectedInstructor(e.target.value)}
                            className="h-10 w-full rounded-lg border border-border px-3 sm:w-auto"
                          >
                            <option value="">Выберите инструктора</option>
                            {instructors.map((inst) => (
                              <option key={inst.id} value={inst.id}>
                                {inst.full_name || inst.id}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAssignInstructor(user.id)}
                          >
                            Назначить
                          </Button>
                          {assignErrorByStudentId[user.id] ? (
                            <p className="text-sm text-danger">
                              {assignErrorByStudentId[user.id]}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4">
          <form
            onSubmit={handleCreateUser}
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-4 shadow-lg sm:p-5"
          >
            <h2 className="text-lg font-semibold text-primary">
              Новый пользователь
            </h2>
            <div className="mt-4 space-y-3">
              <Input
                label="ФИО"
                value={createFullName}
                onChange={(e) => setCreateFullName(e.target.value)}
                required
              />
              <Input
                label="Email"
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                required
              />
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium text-primary">
                    Пароль <span className="ml-1 text-danger">*</span>
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                    onClick={() => setCreatePassword(generatePassword())}
                  >
                    Сгенерировать
                  </Button>
                </div>
                <Input
                  type="text"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-primary">
                  Роль
                </label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as UserRole)}
                  className="h-10 w-full rounded-lg border border-border bg-white px-3 text-primary"
                >
                  <option value="student">Ученик</option>
                  <option value="instructor">Инструктор</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>
            </div>
            {createError ? (
              <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {createError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closeCreateModal}
                disabled={createUser.isPending}
              >
                Отмена
              </Button>
              <Button type="submit" isLoading={createUser.isPending}>
                Создать
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {userToResetPassword ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4">
          <div className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-lg bg-white p-4 shadow-lg sm:p-5">
            <h2 className="text-lg font-semibold text-primary">
              Сбросить пароль?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {userToResetPassword.full_name || 'Без имени'}
            </p>
            <p className="mt-1 break-all text-sm text-muted-foreground">
              {userToResetPassword.email || 'Email не указан'}
            </p>
            {resetPasswordError ? (
              <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {resetPasswordError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setResetPasswordError(null)
                  setUserToResetPassword(null)
                }}
                disabled={sendPasswordReset.isPending}
              >
                Нет
              </Button>
              <Button
                onClick={confirmPasswordReset}
                isLoading={sendPasswordReset.isPending}
              >
                Отправить
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {userToEditProfile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4">
          <form
            onSubmit={handleProfileEditSubmit}
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-4 shadow-lg sm:p-5"
          >
            <h2 className="text-lg font-semibold text-primary">
              Изменить данные
            </h2>
            <div className="mt-4 space-y-3">
              <Input
                label="ФИО"
                value={profileFullName}
                onChange={(e) => setProfileFullName(e.target.value)}
                required
              />
              <Input
                label="Email"
                type="email"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
              />
              <Input
                label="Телефон"
                type="tel"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-primary">
                  Роль
                </label>
                <select
                  value={profileRole}
                  onChange={(e) => setProfileRole(e.target.value as UserRole)}
                  className="h-10 w-full rounded-lg border border-border bg-white px-3 text-primary"
                >
                  <option value="student">Ученик</option>
                  <option value="instructor">Инструктор</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>
              {profileRole === 'instructor' ? (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <p className="font-medium text-primary">Карточка инструктора</p>
                  <Input
                    label="Фото инструктора, ссылка"
                    value={instructorPhotoUrl}
                    onChange={(e) => setInstructorPhotoUrl(e.target.value)}
                  />
                  <Input
                    label="Возраст"
                    type="number"
                    min="18"
                    value={instructorAge}
                    onChange={(e) => setInstructorAge(e.target.value)}
                  />
                  <Input
                    label="Оценка"
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={instructorRating}
                    onChange={(e) => setInstructorRating(e.target.value)}
                  />
                  <Input
                    label="Автомобиль"
                    value={instructorCar}
                    onChange={(e) => setInstructorCar(e.target.value)}
                  />
                  <Input
                    label="Год выпуска"
                    type="number"
                    min="1980"
                    value={instructorCarYear}
                    onChange={(e) => setInstructorCarYear(e.target.value)}
                  />
                  <Input
                    label="Фото автомобиля, ссылка"
                    value={instructorCarPhotoUrl}
                    onChange={(e) => setInstructorCarPhotoUrl(e.target.value)}
                  />
                  <Input
                    label="Оценка отзывов"
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={instructorReviewsRating}
                    onChange={(e) => setInstructorReviewsRating(e.target.value)}
                  />
                  <Input
                    label="Текст отзыва"
                    value={instructorReviewText}
                    onChange={(e) => setInstructorReviewText(e.target.value)}
                  />
                </div>
              ) : null}
            </div>
            {profileEditError ? (
              <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {profileEditError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closeProfileEdit}
                disabled={updateProfile.isPending}
              >
                Отмена
              </Button>
              <Button type="submit" isLoading={updateProfile.isPending}>
                Сохранить
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {userToEditFinance ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4">
          <form
            onSubmit={handleFinanceSubmit}
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-4 shadow-lg sm:p-5"
          >
            <h2 className="text-lg font-semibold text-primary">Расчеты</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {userToEditFinance.full_name || 'Без имени'}
            </p>
            <div className="mt-4 space-y-3">
              <Input
                label="Сумма договора"
                type="number"
                min="0"
                step="0.01"
                value={contractAmount}
                onChange={(e) => setContractAmount(e.target.value)}
                required
              />
              <Input
                label="Срок оплаты"
                type="date"
                value={paymentDueDate}
                onChange={(e) => setPaymentDueDate(e.target.value)}
              />
              <Input
                label="Срок рассрочки"
                type="date"
                value={installmentDueDate}
                onChange={(e) => setInstallmentDueDate(e.target.value)}
              />
            </div>
            {financeError ? (
              <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {financeError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closeFinanceEdit}
                disabled={upsertStudentFinance.isPending}
              >
                Отмена
              </Button>
              <Button type="submit" isLoading={upsertStudentFinance.isPending}>
                Сохранить
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {toastMessage ? (
        <div className="fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-primary shadow-lg">
          <span>{toastMessage}</span>
          <button
            type="button"
            className="text-muted-foreground hover:text-primary"
            aria-label="Закрыть уведомление"
            onClick={() => setToastMessage(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {userToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4">
          <div className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-lg bg-white p-4 shadow-lg sm:p-5">
            <h2 className="text-lg font-semibold text-primary">
              Удалить пользователя?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {userToDelete.full_name || 'Без имени'}
            </p>
            <p className="mt-1 break-all text-xs text-muted-foreground">
              {userToDelete.id}
            </p>
            {deleteError ? (
              <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {deleteError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteError(null)
                  setUserToDelete(null)
                }}
                disabled={deleteProfile.isPending}
              >
                Нет
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
                isLoading={deleteProfile.isPending}
              >
                Да
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

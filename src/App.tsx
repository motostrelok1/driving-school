import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/features/auth/AuthContext'
import { useAuth } from '@/hooks/useAuth'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { Layout } from '@/components/Layout'


const LoginPage = lazy(() =>
  import('@/pages/LoginPage').then((module) => ({ default: module.LoginPage }))
)
const RegisterPage = lazy(() =>
  import('@/pages/RegisterPage').then((module) => ({ default: module.RegisterPage }))
)
const ResetPasswordPage = lazy(() =>
  import('@/pages/ResetPasswordPage').then((module) => ({
    default: module.ResetPasswordPage,
  }))
)
const SchedulePage = lazy(() =>
  import('@/pages/SchedulePage').then((module) => ({ default: module.SchedulePage }))
)
const StudentSchedulePage = lazy(() =>
  import('@/pages/StudentSchedulePage').then((module) => ({
    default: module.StudentSchedulePage,
  }))
)
const StudentProfilePage = lazy(() =>
  import('@/pages/StudentProfilePage').then((module) => ({
    default: module.StudentProfilePage,
  }))
)
const StudentPracticePage = lazy(() =>
  import('@/pages/StudentPracticePage').then((module) => ({
    default: module.StudentPracticePage,
  }))
)
const StudentTheoryPage = lazy(() =>
  import('@/pages/StudentTheoryPage').then((module) => ({
    default: module.StudentTheoryPage,
  }))
)
const StudentTheoryTestingPage = lazy(() =>
  import('@/pages/StudentTheorySectionPage').then((module) => ({
    default: module.StudentTheoryTestingPage,
  }))
)
const StudentTheoryCoursePage = lazy(() =>
  import('@/pages/StudentTheorySectionPage').then((module) => ({
    default: module.StudentTheoryCoursePage,
  }))
)
const StudentPddTopicPage = lazy(() =>
  import('@/pages/StudentTheorySectionPage').then((module) => ({
    default: module.StudentPddTopicPage,
  }))
)
const StudentPddPage = lazy(() =>
  import('@/pages/StudentTheorySectionPage').then((module) => ({
    default: module.StudentPddPage,
  }))
)
const StudentTheoryTicketsPage = lazy(() =>
  import('@/pages/StudentTheorySectionPage').then((module) => ({
    default: module.StudentTheoryTicketsPage,
  }))
)
const StudentTheoryTopicsPage = lazy(() =>
  import('@/pages/StudentTheorySectionPage').then((module) => ({
    default: module.StudentTheoryTopicsPage,
  }))
)
const StudentTheoryMarathonPage = lazy(() =>
  import('@/pages/StudentTheorySectionPage').then((module) => ({
    default: module.StudentTheoryMarathonPage,
  }))
)
const StudentTheoryExamPage = lazy(() =>
  import('@/pages/StudentTheorySectionPage').then((module) => ({
    default: module.StudentTheoryExamPage,
  }))
)
const StudentPaymentPage = lazy(() =>
  import('@/pages/StudentPaymentPage').then((module) => ({
    default: module.StudentPaymentPage,
  }))
)
const InstructorStudentsPage = lazy(() =>
  import('@/pages/InstructorStudentsPage').then((module) => ({
    default: module.InstructorStudentsPage,
  }))
)
const AdminDashboardPage = lazy(() =>
  import('@/pages/AdminDashboardPage').then((module) => ({
    default: module.AdminDashboardPage,
  }))
)
const AdminUsersPage = lazy(() =>
  import('@/pages/AdminUsersPage').then((module) => ({
    default: module.AdminUsersPage,
  }))
)
const AdminSchedulePage = lazy(() =>
  import('@/pages/AdminSchedulePage').then((module) => ({
    default: module.AdminSchedulePage,
  }))
)
const AdminPddPage = lazy(() =>
  import('@/pages/AdminPddPage').then((module) => ({
    default: module.AdminPddPage,
  }))
)
const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage }))
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

function HomeRedirect() {
  const { role, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoading) return

    if (role === 'admin') {
      navigate('/admin', { replace: true })
    } else if (role === 'instructor') {
      navigate('/instructor/schedule', { replace: true })
    } else {
      navigate('/student/profile', { replace: true })
    }
  }, [role, isLoading, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HomeRedirect />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/student/schedule"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Layout>
                    <StudentSchedulePage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/profile"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Layout>
                    <StudentProfilePage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/practice"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Layout>
                    <StudentPracticePage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/theory"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Layout>
                    <StudentTheoryPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/theory/testing"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Layout>
                    <StudentTheoryTestingPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/theory/course"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Layout>
                    <StudentTheoryCoursePage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/theory/course/pdd/:topicId"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Layout>
                    <StudentPddTopicPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/theory/course/pdd"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Layout>
                    <StudentPddPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/theory/training/tickets"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Layout>
                    <StudentTheoryTicketsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/theory/training/topics"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Layout>
                    <StudentTheoryTopicsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/theory/training/marathon"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Layout>
                    <StudentTheoryMarathonPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/theory/exam"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Layout>
                    <StudentTheoryExamPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/payment"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Layout>
                    <StudentPaymentPage />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/instructor/schedule"
              element={
                <ProtectedRoute allowedRoles={['instructor']}>
                  <Layout>
                    <SchedulePage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/instructor/students"
              element={
                <ProtectedRoute allowedRoles={['instructor']}>
                  <Layout>
                    <InstructorStudentsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Layout>
                    <AdminDashboardPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Layout>
                    <AdminUsersPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/schedule"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Layout>
                    <AdminSchedulePage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/pdd"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Layout>
                    <AdminPddPage />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App


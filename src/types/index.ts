export type UserRole = 'student' | 'instructor' | 'admin'

export interface Profile {
  id: string
  role: UserRole
  full_name: string | null
  phone: string | null
  group_id: string | null
  created_at: string
  updated_at: string
}

export interface Group {
  id: string
  name: string
  category: string
  start_date: string | null
  created_at: string
}

export type LessonType = 'theory' | 'practice'
export type LessonStatus = 'scheduled' | 'completed' | 'cancelled'

export interface Lesson {
  id: string
  student_id: string
  instructor_id: string
  type: LessonType
  start_at: string
  duration_minutes: number
  status: LessonStatus
  comment: string | null
  created_at: string
  updated_at: string
}

export interface LessonWithDetails extends Lesson {
  student?: { full_name: string | null } | null
  instructor?: { full_name: string | null } | null
}

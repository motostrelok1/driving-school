export type UserRole = 'student' | 'instructor' | 'admin'

export interface Profile {
  id: string
  role: UserRole
  full_name: string | null
  email: string | null
  phone: string | null
  group_id: string | null
  driving_enabled: boolean
  instructor_photo_url: string | null
  instructor_age: number | null
  instructor_rating: number | null
  instructor_car: string | null
  instructor_car_year: number | null
  instructor_car_photo_url: string | null
  instructor_reviews_rating: number | null
  instructor_review_text: string | null
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

export interface StudentFinance {
  id: string
  student_id: string
  contract_amount: number
  payment_due_date: string | null
  installment_due_date: string | null
  created_at: string
  updated_at: string
}

export type PddContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'image'; src: string; alt?: string; caption?: string }

export interface PddArticleContent {
  blocks?: PddContentBlock[]
}

export interface PddArticle {
  id: string
  topic_id: string
  title: string
  content: PddArticleContent | null
  created_at: string
  updated_at: string
}

export interface TicketAnswer {
  number: number
  text: string
}

export interface TicketQuestion {
  number: number
  text: string
  image?: string
  answers: TicketAnswer[]
  correctAnswer: number
  hint?: string
}

export interface TheoryTicket {
  ticketNumber: number
  title?: string
  questions: TicketQuestion[]
}



export interface DrivingSlot {
  id: string
  instructor_id: string
  student_id: string | null
  start_at: string
  duration_minutes: number
  status: 'open' | 'booked' | 'reserved' | 'cancelled'
  comment: string | null
  created_at: string
  updated_at: string
  instructor?: { full_name: string | null } | null
  student?: { full_name: string | null } | null
}

export interface InstructorReview {
  id: string
  instructor_id: string
  student_id: string
  rating: number
  text: string
  created_at: string
  student?: { full_name: string | null } | null
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

export type TheoryAssessmentKind = 'credit' | 'internal_exam'

export interface TheoryAssessment {
  id: string
  student_id: string
  created_by: string | null
  kind: TheoryAssessmentKind
  rules_version: string
  topic_ids: string[]
  question_count: number
  time_limit_minutes: number
  max_errors: number
  opens_at: string
  deadline_at: string
  cancelled_at: string | null
  created_at: string
}

export interface TheoryAssessmentAttempt {
  id: string
  assessment_id: string
  student_id: string
  rules_version: string
  question_count: number
  time_limit_minutes: number
  max_errors: number
  question_snapshot: Array<Omit<TicketQuestion, 'correctAnswer' | 'hint'> & { key: string; ticketNumber: number }>
  started_at: string
  expires_at: string
  finished_at: string | null
  status: 'running' | 'completed' | 'expired'
  correct_count: number | null
  error_count: number | null
  elapsed_seconds: number | null
  passed: boolean | null
}

export interface TheoryAttemptAnswer {
  id: string
  attempt_id: string
  question_index: number
  selected_answer: number
  answered_at: string
  is_correct: boolean
}

export type TheoryAssessmentAttemptSummary = Omit<TheoryAssessmentAttempt, 'question_snapshot'>

export interface Note {
  id: string
  subject: string
  unit_name: string
  hashtags: string[]
  image_urls: string[]
  created_at: string
  updated_at: string
}

export interface Schedule {
  id: string
  title: string
  subject: string
  types: string[]
  exam_date: string
  description: string | null
  created_at: string
}

export interface Memo {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export const SUBJECTS = [
  '국어', '수학', '영어', '과학', '사회', '역사',
  '도덕', '기술가정', '음악', '미술', '체육', '정보',
]

export const SCHEDULE_TYPES = ['지필평가', '수행평가', '숙제']

export const SUBJECT_COLORS: Record<string, string> = {
  '국어':   'bg-red-100 text-red-700',
  '수학':   'bg-blue-100 text-blue-700',
  '영어':   'bg-green-100 text-green-700',
  '과학':   'bg-purple-100 text-purple-700',
  '사회':   'bg-yellow-100 text-yellow-700',
  '역사':   'bg-orange-100 text-orange-700',
  '도덕':   'bg-pink-100 text-pink-700',
  '기술가정': 'bg-teal-100 text-teal-700',
  '음악':   'bg-indigo-100 text-indigo-700',
  '미술':   'bg-rose-100 text-rose-700',
  '체육':   'bg-lime-100 text-lime-700',
  '정보':   'bg-cyan-100 text-cyan-700',
}

export const SCHEDULE_TYPE_COLORS: Record<string, string> = {
  '지필평가': 'bg-blue-500 text-white',
  '수행평가': 'bg-green-500 text-white',
  '숙제':    'bg-orange-400 text-white',
}

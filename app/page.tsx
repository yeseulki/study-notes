'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Note, Schedule, Memo } from '@/types'
import { SUBJECT_COLORS } from '@/types'
import ScheduleCard from '@/components/ScheduleCard'
import NoteCard from '@/components/NoteCard'
import { BookOpen, Calendar, ShieldCheck, Search, StickyNote, ChevronDown, ChevronUp } from 'lucide-react'

function normalize(str: string) {
  return str.toLowerCase().replace(/[\s#]+/g, '')
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = normalize(query)
  if (!q) return false
  return normalize(text).includes(q)
}

// Safely parse value that might be JS array, PostgreSQL "{a,b}" string, or JSON
function parseDbArray(val: any): string[] {
  if (Array.isArray(val)) return val.filter(Boolean)
  if (typeof val === 'string') {
    if (val.startsWith('{') && val.endsWith('}'))
      return val.slice(1, -1).split(',').map((s: string) => s.trim()).filter(Boolean)
    try { const p = JSON.parse(val); return Array.isArray(p) ? p.filter(Boolean) : [] } catch { return [] }
  }
  return []
}

export default function HomePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [notes, setNotes]         = useState<Note[]>([])
  const [memos, setMemos]         = useState<Memo[]>([])
  const [loadingSched, setLoadingSched] = useState(true)
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [activeSubject, setActiveSubject] = useState<string>('전체')
  const [searchQuery, setSearchQuery]     = useState('')
  const [expandedMemo,   setExpandedMemo]   = useState<string | null>(null)
  const [showAllMemos,   setShowAllMemos]   = useState(false)
  const [showAllSched,   setShowAllSched]   = useState(false)

  const COLLAPSE_AT = 3

  useEffect(() => {
    fetchSchedules()
    fetchNotes()
    fetchMemos()
  }, [])

  async function fetchSchedules() {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .gte('exam_date', today)
      .order('exam_date', { ascending: true })
      .limit(10)
    setSchedules((data ?? []).map((s: any) => {
      const parsed = parseDbArray(s.types)
      return {
        ...s,
        types: parsed.length > 0
          ? parsed
          : s.type
            ? [s.type === 'exam' ? '지필평가' : '수행평가']
            : [],
      }
    }))
    setLoadingSched(false)
  }

  async function fetchNotes() {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false })
    setNotes((data ?? []).map((n: any) => ({
      ...n,
      image_urls: parseDbArray(n.image_urls),
      hashtags:   parseDbArray(n.hashtags),
    })))
    setLoadingNotes(false)
  }

  async function fetchMemos() {
    const { data } = await supabase
      .from('memos')
      .select('*')
      .order('created_at', { ascending: false })
    setMemos(data ?? [])
  }

  const subjects = ['전체', ...Array.from(new Set(notes.map(n => n.subject)))]

  const filteredNotes = notes.filter(n => {
    const matchSubject = activeSubject === '전체' || n.subject === activeSubject
    if (!matchSubject) return false
    if (!searchQuery.trim()) return true
    const matchUnit = fuzzyMatch(searchQuery, n.unit_name)
    const matchTags = n.hashtags.some((tag: string) => fuzzyMatch(searchQuery, tag))
    return matchUnit || matchTags
  })

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <BookOpen className="text-blue-600" size={22} />
            <span className="font-bold text-lg text-gray-900">우리반 공부노트</span>
          </div>
          <Link
            href="/admin"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            <ShieldCheck size={16} />
            <span>관리자</span>
          </Link>
        </div>
      </header>

      <main className="px-4 pt-5 space-y-8">

        {/* ── Memos / 공지사항 ── */}
        {memos.length > 0 && (
          <section>
            <h2 className="flex items-center gap-2 text-base font-bold text-gray-800 mb-3">
              <StickyNote size={18} className="text-yellow-500" />
              게시판
            </h2>
            <div className="space-y-2">
              {(showAllMemos ? memos : memos.slice(0, COLLAPSE_AT)).map(memo => (
                <div key={memo.id} className="bg-yellow-50 border border-yellow-200 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setExpandedMemo(expandedMemo === memo.id ? null : memo.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                  >
                    <span className="font-semibold text-gray-900 text-sm">{memo.title}</span>
                    {expandedMemo === memo.id
                      ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
                      : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
                  </button>
                  {expandedMemo === memo.id && (
                    <div className="px-4 pb-4">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{memo.content}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {memos.length > COLLAPSE_AT && (
              <button
                onClick={() => setShowAllMemos(v => !v)}
                className="mt-2 w-full flex items-center justify-center gap-1 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                {showAllMemos
                  ? <><ChevronUp size={15} /> 접기</>
                  : <><ChevronDown size={15} /> 더 보기 ({memos.length - COLLAPSE_AT}개 더)</>}
              </button>
            )}
          </section>
        )}

        {/* ── Upcoming Schedule ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-gray-800">
              <Calendar size={18} className="text-blue-600" />
              일정
            </h2>
          </div>

          {loadingSched ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              예정된 시험이 없어요 🎉
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {(showAllSched ? schedules : schedules.slice(0, COLLAPSE_AT)).map(s => (
                  <ScheduleCard key={s.id} schedule={s} />
                ))}
              </div>
              {schedules.length > COLLAPSE_AT && (
                <button
                  onClick={() => setShowAllSched(v => !v)}
                  className="mt-2 w-full flex items-center justify-center gap-1 py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  {showAllSched
                    ? <><ChevronUp size={15} /> 접기</>
                    : <><ChevronDown size={15} /> 더 보기 ({schedules.length - COLLAPSE_AT}개 더)</>}
                </button>
              )}
            </>
          )}
        </section>

        {/* ── Notes ── */}
        <section>
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-800 mb-3">
            <BookOpen size={18} className="text-blue-600" />
            필기
          </h2>

          {/* Search bar */}
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="제목, 해시태그로 검색..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Subject filter — horizontal scroll */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-4">
            {subjects.map(s => (
              <button
                key={s}
                onClick={() => setActiveSubject(s)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeSubject === s
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {loadingNotes ? (
            <div className="grid grid-cols-2 gap-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              {searchQuery.trim() ? `"${searchQuery}" 검색 결과가 없어요` : '아직 업로드된 노트가 없어요'}
            </div>
          ) : (
            <>
              {searchQuery.trim() && (
                <p className="text-xs text-gray-500 mb-3">{filteredNotes.length}개 결과</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                {filteredNotes.map(note => <NoteCard key={note.id} note={note} />)}
              </div>
            </>
          )}
        </section>

      </main>
    </div>
  )
}

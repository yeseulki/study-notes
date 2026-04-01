'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase, STORAGE_BUCKET } from '@/lib/supabase'
import type { Note, Schedule, Memo } from '@/types'
import { SUBJECTS, SCHEDULE_TYPES } from '@/types'
import {
  ArrowLeft, Lock, Upload, Trash2, Pencil, Plus, X,
  Image as ImageIcon, CalendarPlus, StickyNote, Hash,
} from 'lucide-react'

// ─── Hashtag helpers ───────────────────────────────────────────────────────
// Accepts both "#태그" and "태그" formats, comma/space separated
function parseHashtags(input: string): string[] {
  return input
    .split(/[\s,]+/)
    .map(t => t.replace(/^#+/, '').trim())
    .filter(t => t.length > 0)
}

// Safely parse a value that might be a JS array, PostgreSQL "{a,b}" string, or JSON
function parseDbArray(val: any): string[] {
  if (Array.isArray(val)) return val.filter(Boolean)
  if (typeof val === 'string') {
    if (val.startsWith('{') && val.endsWith('}'))
      return val.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean)
    try { const p = JSON.parse(val); return Array.isArray(p) ? p.filter(Boolean) : [] } catch { return [] }
  }
  return []
}

// ─── Admin password gate ───────────────────────────────────────────────────
function PasswordGate({ onSuccess }: { onSuccess: () => void }) {
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      if (res.ok) {
        sessionStorage.setItem('admin_auth', '1')
        onSuccess()
      } else {
        setError('비밀번호가 틀렸어요.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
            <Lock className="text-blue-600" size={26} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">관리자 로그인</h1>
          <p className="text-sm text-gray-500 text-center">관리자 비밀번호를 입력하세요</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="비밀번호"
            autoFocus
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || !pw}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '확인 중...' : '입장하기'}
          </button>
        </form>
        <Link href="/" className="mt-4 flex items-center justify-center gap-1 text-sm text-gray-400 hover:text-gray-600">
          <ArrowLeft size={14} /> 홈으로
        </Link>
      </div>
    </div>
  )
}

// ─── Upload Note Form ──────────────────────────────────────────────────────
function UploadNoteForm({ onDone }: { onDone: () => void }) {
  const [subject,      setSubject]      = useState(SUBJECTS[0])
  const [unitName,     setUnitName]     = useState('')
  const [hashtagInput, setHashtagInput] = useState('')
  const [files,        setFiles]        = useState<File[]>([])
  const [previews,     setPreviews]     = useState<string[]>([])
  const [loading,      setLoading]      = useState(false)

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    if (selected.length === 0) return
    setFiles(prev => [...prev, ...selected])
    setPreviews(prev => [...prev, ...selected.map(f => URL.createObjectURL(f))])
    // reset input so same file can be re-added if needed
    e.target.value = ''
  }

  function removeFile(i: number) {
    setFiles(prev => prev.filter((_, idx) => idx !== i))
    setPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!unitName.trim() || files.length === 0) {
      toast.error('단원명과 이미지를 입력하세요')
      return
    }
    setLoading(true)
    try {
      const imageUrls: string[] = []
      for (const file of files) {
        const ext  = file.name.split('.').pop()
        const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        })
        if (error) throw error
        const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
        imageUrls.push(data.publicUrl)
      }

      const hashtags = parseHashtags(hashtagInput)

      const { error: dbErr } = await supabase.from('notes').insert({
        subject,
        type: 'exam',
        unit_name: unitName.trim(),
        hashtags,
        image_urls: imageUrls,
      })
      if (dbErr) throw dbErr

      toast.success('노트가 업로드됐어요!')
      setUnitName(''); setHashtagInput(''); setFiles([]); setPreviews([])
      onDone()
    } catch (err: any) {
      toast.error(err.message ?? '업로드 실패')
    } finally {
      setLoading(false)
    }
  }

  const parsedTags = parseHashtags(hashtagInput)

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <h2 className="font-bold text-gray-800 flex items-center gap-2">
        <ImageIcon size={18} className="text-blue-600" /> 노트 업로드
      </h2>

      {/* Subject */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">과목</label>
        <select
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Unit name */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">단원명</label>
        <input
          type="text"
          value={unitName}
          onChange={e => setUnitName(e.target.value)}
          placeholder="예) 2단원 – 이차방정식"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Hashtags */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
          <Hash size={14} /> 해시태그 <span className="text-gray-400 font-normal">(선택)</span>
        </label>
        <input
          type="text"
          value={hashtagInput}
          onChange={e => setHashtagInput(e.target.value)}
          placeholder="#함수 #이차방정식 #수학"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {parsedTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {parsedTags.map(tag => (
              <span key={tag} className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Image upload */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">
          사진 첨부 <span className="text-gray-400 font-normal">(여러 장 가능 · 탭할 때마다 추가)</span>
        </label>
        <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
          <Upload size={22} className="text-gray-400 mb-1" />
          <span className="text-sm text-gray-500">탭하여 사진 추가</span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFiles}
            className="hidden"
          />
        </label>

        {previews.length > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide pb-1">
            {previews.map((src, i) => (
              <div key={i} className="relative flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-20 w-20 object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        {files.length > 0 && (
          <p className="text-xs text-gray-400 mt-1">{files.length}장 선택됨</p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
      >
        <Upload size={18} />
        {loading ? '업로드 중...' : '업로드하기'}
      </button>
    </form>
  )
}

// ─── Add Schedule Form ─────────────────────────────────────────────────────
function AddScheduleForm({ onDone }: { onDone: () => void }) {
  const [subject,  setSubject]  = useState(SUBJECTS[0])
  const [types,    setTypes]    = useState<string[]>([])
  const [title,    setTitle]    = useState('')
  const [date,     setDate]     = useState('')
  const [desc,     setDesc]     = useState('')
  const [loading,  setLoading]  = useState(false)

  function toggleType(t: string) {
    setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !date) { toast.error('제목과 날짜를 입력하세요'); return }
    if (types.length === 0) { toast.error('카테고리를 하나 이상 선택하세요'); return }
    setLoading(true)
    try {
      const base = { subject, type: 'exam', title: title.trim(), exam_date: date, description: desc.trim() || null }

      // Try with types column; if it doesn't exist yet, fall back without it
      let { error } = await supabase.from('schedules').insert({ ...base, types })
      if (error?.message?.includes('types')) {
        ;({ error } = await supabase.from('schedules').insert(base))
      }
      if (error) throw error

      toast.success('일정이 추가됐어요!')
      setTitle(''); setDate(''); setDesc(''); setTypes([])
      onDone()
    } catch (err: any) {
      toast.error(err.message ?? '저장 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <h2 className="font-bold text-gray-800 flex items-center gap-2">
        <CalendarPlus size={18} className="text-green-600" /> 시험 일정 추가
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">과목</label>
          <select
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">날짜</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Multi-select category */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1.5 block">
          카테고리 <span className="text-gray-400 font-normal">(복수 선택 가능)</span>
        </label>
        <div className="flex gap-2">
          {SCHEDULE_TYPES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                types.includes(t)
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="시험 제목 (예: 1학기 중간고사)"
        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <textarea
        value={desc}
        onChange={e => setDesc(e.target.value)}
        placeholder="추가 설명 (선택)"
        rows={2}
        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
      >
        <Plus size={18} />
        {loading ? '저장 중...' : '일정 추가'}
      </button>
    </form>
  )
}

// ─── Add Memo Form ─────────────────────────────────────────────────────────
function AddMemoForm({ onDone }: { onDone: () => void }) {
  const [title,   setTitle]   = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) { toast.error('제목과 내용을 입력하세요'); return }
    setLoading(true)
    try {
      const { error } = await supabase.from('memos').insert({
        title: title.trim(),
        content: content.trim(),
      })
      if (error) throw error
      toast.success('메모가 추가됐어요!')
      setTitle(''); setContent('')
      onDone()
    } catch (err: any) {
      toast.error(err.message ?? '저장 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <h2 className="font-bold text-gray-800 flex items-center gap-2">
        <StickyNote size={18} className="text-yellow-500" /> 공지 / 메모 추가
      </h2>

      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="제목 (예: 1학기 중간고사 시험 범위)"
        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="내용을 입력하세요 (시험 범위, 공지사항 등)"
        rows={5}
        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-yellow-500 text-white font-semibold py-3 rounded-xl hover:bg-yellow-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
      >
        <Plus size={18} />
        {loading ? '저장 중...' : '메모 추가'}
      </button>
    </form>
  )
}

// ─── Manage existing notes, schedules & memos ─────────────────────────────
function ManagePanel({ refresh }: { refresh: number }) {
  const [notes,     setNotes]     = useState<Note[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [memos,     setMemos]     = useState<Memo[]>([])
  const [tab,          setTab]         = useState<'notes' | 'schedules' | 'memos'>('schedules')
  const [editNote,     setEditNote]     = useState<Note | null>(null)
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null)
  const [editMemo,     setEditMemo]     = useState<Memo | null>(null)

  useEffect(() => {
    supabase.from('notes').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setNotes((data ?? []).map((n: any) => ({
        ...n,
        image_urls: parseDbArray(n.image_urls),
        hashtags:   parseDbArray(n.hashtags),
      }))))

    supabase.from('schedules').select('*').order('exam_date', { ascending: true })
      .then(({ data }) => setSchedules((data ?? []).map((s: any) => {
        const parsed = parseDbArray(s.types)
        return {
          ...s,
          types: parsed.length > 0
            ? parsed
            : s.type ? [s.type === 'exam' ? '지필평가' : '수행평가'] : [],
        }
      })))

    supabase.from('memos').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setMemos(data ?? []))
  }, [refresh])

  async function deleteNote(note: Note) {
    if (!confirm('노트를 삭제할까요?')) return
    for (const url of note.image_urls) {
      const path = url.split(`${STORAGE_BUCKET}/`)[1]
      if (path) await supabase.storage.from(STORAGE_BUCKET).remove([path])
    }
    await supabase.from('notes').delete().eq('id', note.id)
    toast.success('삭제됐어요')
    setNotes(prev => prev.filter(n => n.id !== note.id))
  }

  async function deleteSchedule(id: string) {
    if (!confirm('일정을 삭제할까요?')) return
    await supabase.from('schedules').delete().eq('id', id)
    toast.success('삭제됐어요')
    setSchedules(prev => prev.filter(s => s.id !== id))
  }

  async function deleteMemo(id: string) {
    if (!confirm('메모를 삭제할까요?')) return
    await supabase.from('memos').delete().eq('id', id)
    toast.success('삭제됐어요')
    setMemos(prev => prev.filter(m => m.id !== id))
  }

  const TABS = [
    { key: 'memos',     label: `게시판 (${memos.length})` },
    { key: 'schedules', label: `일정 (${schedules.length})` },
    { key: 'notes',     label: `필기 (${notes.length})` },
  ] as const

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === t.key ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
        {tab === 'schedules' && (
          schedules.length === 0
            ? <p className="text-center py-8 text-gray-400 text-sm">일정 없음</p>
            : schedules.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{s.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {s.subject} · {s.types.join(', ')} · {s.exam_date}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditSchedule(s)} className="text-blue-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => deleteSchedule(s.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
        )}

        {tab === 'notes' && (
          notes.length === 0
            ? <p className="text-center py-8 text-gray-400 text-sm">노트 없음</p>
            : notes.map(n => (
              <div key={n.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{n.unit_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {n.subject} · {n.image_urls.length}장
                    {n.hashtags.length > 0 && ` · ${n.hashtags.map((t: string) => '#' + t).join(' ')}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditNote(n)} className="text-blue-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => deleteNote(n)} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
        )}

        {tab === 'memos' && (
          memos.length === 0
            ? <p className="text-center py-8 text-gray-400 text-sm">메모 없음</p>
            : memos.map(m => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{m.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{m.content}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditMemo(m)} className="text-blue-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => deleteMemo(m.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
        )}
      </div>

      {editNote && (
        <EditNoteModal
          note={editNote}
          onClose={() => setEditNote(null)}
          onSaved={(updated) => {
            setNotes(prev => prev.map(n => n.id === updated.id ? updated : n))
            setEditNote(null)
          }}
        />
      )}

      {editSchedule && (
        <EditScheduleModal
          schedule={editSchedule}
          onClose={() => setEditSchedule(null)}
          onSaved={(updated) => {
            setSchedules(prev => prev.map(s => s.id === updated.id ? updated : s))
            setEditSchedule(null)
          }}
        />
      )}

      {editMemo && (
        <EditMemoModal
          memo={editMemo}
          onClose={() => setEditMemo(null)}
          onSaved={(updated) => {
            setMemos(prev => prev.map(m => m.id === updated.id ? updated : m))
            setEditMemo(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Edit Schedule Modal ───────────────────────────────────────────────────
function EditScheduleModal({ schedule, onClose, onSaved }: {
  schedule: Schedule
  onClose: () => void
  onSaved: (s: Schedule) => void
}) {
  const [subject, setSubject] = useState(schedule.subject)
  const [types,   setTypes]   = useState<string[]>([...(schedule.types ?? [])])
  const [title,   setTitle]   = useState(schedule.title)
  const [date,    setDate]    = useState(schedule.exam_date)
  const [desc,    setDesc]    = useState(schedule.description ?? '')
  const [loading, setLoading] = useState(false)

  function toggleType(t: string) {
    setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  async function save() {
    if (!title.trim() || !date) { toast.error('제목과 날짜를 입력하세요'); return }
    if (types.length === 0) { toast.error('카테고리를 하나 이상 선택하세요'); return }
    setLoading(true)

    const base = { subject, type: 'exam', title: title.trim(), exam_date: date, description: desc.trim() || null }

    // Try with types column; if column doesn't exist yet, fall back without it
    let { data, error } = await supabase
      .from('schedules')
      .update({ ...base, types })
      .eq('id', schedule.id)
      .select()
      .single()

    if (error?.message?.includes('types')) {
      ;({ data, error } = await supabase
        .from('schedules')
        .update(base)
        .eq('id', schedule.id)
        .select()
        .single())
    }

    setLoading(false)
    if (error) { toast.error(error.message ?? '저장 실패'); return }
    toast.success('수정됐어요!')
    onSaved({ ...(data as Schedule), types })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">일정 수정</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">과목</label>
            <select
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">날짜</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">카테고리 (복수 선택)</label>
          <div className="flex gap-2">
            {SCHEDULE_TYPES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${
                  types.includes(t)
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="시험 제목"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="추가 설명 (선택)"
          rows={2}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />

        <button
          onClick={save}
          disabled={loading}
          className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition-colors"
        >
          {loading ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}

// ─── Edit Note Modal (with image editing) ─────────────────────────────────
function EditNoteModal({ note, onClose, onSaved }: {
  note: Note
  onClose: () => void
  onSaved: (n: Note) => void
}) {
  const [subject,      setSubject]      = useState(note.subject)
  const [unitName,     setUnitName]     = useState(note.unit_name)
  const [hashtagInput, setHashtagInput] = useState(
    note.hashtags.map((t: string) => '#' + t).join(' ')
  )
  const [existingUrls, setExistingUrls] = useState<string[]>([...note.image_urls])
  const [removedUrls,  setRemovedUrls]  = useState<string[]>([])
  const [newFiles,     setNewFiles]     = useState<File[]>([])
  const [newPreviews,  setNewPreviews]  = useState<string[]>([])
  const [loading,      setLoading]      = useState(false)

  function removeExisting(i: number) {
    const url = existingUrls[i]
    setRemovedUrls(prev => [...prev, url])
    setExistingUrls(prev => prev.filter((_, idx) => idx !== i))
  }

  function handleNewFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    if (selected.length === 0) return
    setNewFiles(prev => [...prev, ...selected])
    setNewPreviews(prev => [...prev, ...selected.map(f => URL.createObjectURL(f))])
    e.target.value = ''
  }

  function removeNew(i: number) {
    setNewFiles(prev => prev.filter((_, idx) => idx !== i))
    setNewPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  async function save() {
    if (existingUrls.length + newFiles.length === 0) {
      toast.error('사진이 최소 1장 이상 있어야 해요')
      return
    }
    setLoading(true)
    try {
      // Delete removed images from storage
      for (const url of removedUrls) {
        const path = url.split(`${STORAGE_BUCKET}/`)[1]
        if (path) await supabase.storage.from(STORAGE_BUCKET).remove([path])
      }

      // Upload new images
      const newUrls: string[] = []
      for (const file of newFiles) {
        const ext  = file.name.split('.').pop()
        const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        })
        if (error) throw error
        const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
        newUrls.push(data.publicUrl)
      }

      const finalUrls = [...existingUrls, ...newUrls]
      const hashtags  = parseHashtags(hashtagInput)

      const { data, error } = await supabase
        .from('notes')
        .update({ subject, unit_name: unitName, hashtags, image_urls: finalUrls })
        .eq('id', note.id)
        .select()
        .single()

      if (error) throw error
      toast.success('수정됐어요!')
      onSaved({
        ...data as Note,
        image_urls: finalUrls,
        hashtags,
      })
    } catch (err: any) {
      toast.error(err.message ?? '저장 실패')
    } finally {
      setLoading(false)
    }
  }

  const parsedTags = parseHashtags(hashtagInput)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">노트 수정</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <select
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <input
          type="text"
          value={unitName}
          onChange={e => setUnitName(e.target.value)}
          placeholder="단원명"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Hashtag edit */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <Hash size={13} /> 해시태그
          </label>
          <input
            type="text"
            value={hashtagInput}
            onChange={e => setHashtagInput(e.target.value)}
            placeholder="#함수 #이차방정식"
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {parsedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {parsedTags.map(tag => (
                <span key={tag} className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Existing images */}
        {existingUrls.length > 0 && (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              현재 사진 ({existingUrls.length}장)
            </label>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {existingUrls.map((url, i) => (
                <div key={i} className="relative flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-20 w-20 object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => removeExisting(i)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add new images */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            사진 추가
          </label>
          <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
            <Upload size={18} className="text-gray-400 mb-0.5" />
            <span className="text-xs text-gray-500">탭하여 사진 추가</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleNewFiles}
              className="hidden"
            />
          </label>
          {newPreviews.length > 0 && (
            <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide pb-1">
              {newPreviews.map((src, i) => (
                <div key={i} className="relative flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-20 w-20 object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => removeNew(i)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={save}
          disabled={loading}
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition-colors"
        >
          {loading ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}

// ─── Edit Memo Modal ───────────────────────────────────────────────────────
function EditMemoModal({ memo, onClose, onSaved }: {
  memo: Memo
  onClose: () => void
  onSaved: (m: Memo) => void
}) {
  const [title,   setTitle]   = useState(memo.title)
  const [content, setContent] = useState(memo.content)
  const [loading, setLoading] = useState(false)

  async function save() {
    if (!title.trim() || !content.trim()) { toast.error('제목과 내용을 입력하세요'); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('memos')
      .update({ title: title.trim(), content: content.trim() })
      .eq('id', memo.id)
      .select()
      .single()
    setLoading(false)
    if (error) { toast.error('저장 실패'); return }
    toast.success('수정됐어요!')
    onSaved(data as Memo)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">메모 수정</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={5}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <button
          onClick={save}
          disabled={loading}
          className="w-full bg-yellow-500 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
        >
          {loading ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Admin Page ───────────────────────────────────────────────────────
export default function AdminPage() {
  const [authed,  setAuthed]  = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    if (sessionStorage.getItem('admin_auth') === '1') setAuthed(true)
  }, [])

  if (!authed) return <PasswordGate onSuccess={() => setAuthed(true)} />

  function handleDone() { setRefresh(r => r + 1) }

  return (
    <div className="max-w-2xl mx-auto pb-24">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft size={20} /> 홈
          </Link>
          <span className="font-bold text-gray-900">관리자 페이지</span>
          <button
            onClick={() => { sessionStorage.removeItem('admin_auth'); setAuthed(false) }}
            className="text-sm text-red-500 hover:text-red-700"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="px-4 pt-5 space-y-6">
        <UploadNoteForm onDone={handleDone} />
        <AddScheduleForm onDone={handleDone} />
        <AddMemoForm onDone={handleDone} />
        <ManagePanel refresh={refresh} />
      </main>
    </div>
  )
}

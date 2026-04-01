'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import type { Note } from '@/types'
import { SUBJECT_COLORS } from '@/types'
import { ArrowLeft, ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react'

function parseDbArray(val: any): string[] {
  if (Array.isArray(val)) return val.filter(Boolean)
  if (typeof val === 'string') {
    if (val.startsWith('{') && val.endsWith('}'))
      return val.slice(1, -1).split(',').map((s: string) => s.trim()).filter(Boolean)
    try { const p = JSON.parse(val); return Array.isArray(p) ? p.filter(Boolean) : [] } catch { return [] }
  }
  return []
}

export default function NoteDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const [note, setNote]         = useState<Note | null>(null)
  const [loading, setLoading]   = useState(true)
  const [viewer, setViewer]     = useState<{ open: boolean; index: number }>({ open: false, index: 0 })

  useEffect(() => {
    supabase.from('notes').select('*').eq('id', id).single()
      .then(({ data }) => {
        if (data) {
          data.image_urls = parseDbArray(data.image_urls)
          data.hashtags   = parseDbArray(data.hashtags)
        }
        setNote(data)
        setLoading(false)
      })
  }, [id])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!note) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <p className="text-gray-500">노트를 찾을 수 없어요</p>
      <button onClick={() => router.back()} className="text-blue-600">← 돌아가기</button>
    </div>
  )

  const colorClass = SUBJECT_COLORS[note.subject] ?? 'bg-gray-100 text-gray-700'
  const hashtags   = Array.isArray(note.hashtags) ? note.hashtags : []

  return (
    <>
      <div className="max-w-2xl mx-auto pb-10">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => router.back()} className="p-1 -ml-1 text-gray-600">
              <ArrowLeft size={22} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-gray-900 truncate">{note.unit_name}</h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>{note.subject}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Image grid */}
        <div className="px-4 pt-4 space-y-3">
          {Array.isArray(note.image_urls) && note.image_urls.map((url, i) => (
            <button
              key={i}
              onClick={() => setViewer({ open: true, index: i })}
              className="w-full block relative rounded-xl overflow-hidden shadow-sm border border-gray-100"
            >
              <Image
                src={url}
                alt={`노트 ${i + 1}`}
                width={800}
                height={600}
                className="w-full h-auto object-contain bg-gray-50"
                priority={i === 0}
                unoptimized
              />
              <div className="absolute bottom-2 right-2 bg-black/40 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                <ZoomIn size={11} /> 확대
              </div>
            </button>
          ))}

          {/* Hashtags below photos */}
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1 pb-2">
              {hashtags.map(tag => (
                <span key={tag} className="text-sm text-blue-500 font-medium bg-blue-50 px-3 py-1 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Full-screen image viewer */}
      {viewer.open && (
        <ImageViewer
          urls={note.image_urls}
          hashtags={hashtags}
          initialIndex={viewer.index}
          onClose={() => setViewer({ open: false, index: 0 })}
        />
      )}
    </>
  )
}

// ─── Full-screen pinch-zoom viewer ────────────────────────────────────────
function ImageViewer({
  urls,
  hashtags,
  initialIndex,
  onClose,
}: {
  urls: string[]
  hashtags: string[]
  initialIndex: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(initialIndex)
  const imgRef    = useRef<HTMLDivElement>(null)
  const scaleRef  = useRef(1)
  const lastDist  = useRef(0)
  const lastPos   = useRef({ x: 0, y: 0 })
  const translate = useRef({ x: 0, y: 0 })
  const touchStart= useRef<{ x: number; y: number } | null>(null)

  const applyTransform = useCallback(() => {
    if (!imgRef.current) return
    imgRef.current.style.transform =
      `translate(${translate.current.x}px, ${translate.current.y}px) scale(${scaleRef.current})`
  }, [])

  function resetTransform() {
    scaleRef.current  = 1
    translate.current = { x: 0, y: 0 }
    applyTransform()
  }

  function changeImage(dir: 1 | -1) {
    resetTransform()
    setIndex(i => Math.max(0, Math.min(urls.length - 1, i + dir)))
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1) {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      lastPos.current    = { ...translate.current }
    }
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastDist.current = Math.hypot(dx, dy)
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    e.preventDefault()
    if (e.touches.length === 2) {
      const dx   = e.touches[0].clientX - e.touches[1].clientX
      const dy   = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      const delta = dist / lastDist.current
      scaleRef.current = Math.min(5, Math.max(1, scaleRef.current * delta))
      lastDist.current = dist
      applyTransform()
    } else if (e.touches.length === 1 && scaleRef.current > 1) {
      const dx = e.touches[0].clientX - (touchStart.current?.x ?? 0)
      const dy = e.touches[0].clientY - (touchStart.current?.y ?? 0)
      translate.current = {
        x: lastPos.current.x + dx,
        y: lastPos.current.y + dy,
      }
      applyTransform()
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (e.changedTouches.length === 1 && scaleRef.current <= 1 && touchStart.current) {
      const dx = e.changedTouches[0].clientX - touchStart.current.x
      if (Math.abs(dx) > 50) changeImage(dx < 0 ? 1 : -1)
    }
    if (e.touches.length < 2) lastDist.current = 0
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* toolbar */}
      <div className="flex items-center justify-between px-4 pt-safe py-3 text-white">
        <button onClick={onClose} className="p-2"><X size={24} /></button>
        <span className="text-sm font-medium">{index + 1} / {urls.length}</span>
        <button onClick={resetTransform} className="p-2 text-gray-400 hover:text-white">
          <ZoomIn size={22} />
        </button>
      </div>

      {/* image */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          ref={imgRef}
          className="transition-none will-change-transform"
          style={{ touchAction: 'none' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls[index]}
            alt=""
            className="max-w-screen max-h-[80dvh] w-full object-contain select-none"
            draggable={false}
          />
        </div>
      </div>

      {/* prev / next arrows */}
      <div className="flex items-center justify-between px-4 pb-2">
        <button
          onClick={() => changeImage(-1)}
          disabled={index === 0}
          className="p-3 bg-white/10 rounded-full disabled:opacity-30 text-white"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex gap-1.5">
          {urls.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${i === index ? 'bg-white' : 'bg-white/30'}`} />
          ))}
        </div>
        <button
          onClick={() => changeImage(1)}
          disabled={index === urls.length - 1}
          className="p-3 bg-white/10 rounded-full disabled:opacity-30 text-white"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Hashtags inside viewer */}
      {hashtags.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 px-4 pb-8">
          {hashtags.map(tag => (
            <span key={tag} className="text-xs text-blue-300 bg-white/10 px-3 py-1 rounded-full font-medium">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

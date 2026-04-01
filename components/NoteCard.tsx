import Link from 'next/link'
import Image from 'next/image'
import type { Note } from '@/types'
import { SUBJECT_COLORS } from '@/types'
import { Images } from 'lucide-react'

export default function NoteCard({ note }: { note: Note }) {
  const colorClass = SUBJECT_COLORS[note.subject] ?? 'bg-gray-100 text-gray-700'
  const thumb      = note.image_urls[0]
  const hashtags   = Array.isArray(note.hashtags) ? note.hashtags : []

  return (
    <Link
      href={`/notes/${note.id}`}
      className="block bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm active:scale-95 transition-transform"
    >
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        {thumb ? (
          <Image
            src={thumb}
            alt={note.unit_name}
            fill
            className="object-cover"
            sizes="(max-width: 672px) 50vw, 336px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-300">
            <Images size={32} />
          </div>
        )}
        {note.image_urls.length > 1 && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/50 text-white text-xs font-medium px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <Images size={10} /> {note.image_urls.length}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{note.unit_name}</p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>
            {note.subject}
          </span>
        </div>
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {hashtags.slice(0, 3).map(tag => (
              <span key={tag} className="text-xs text-blue-500 font-medium">#{tag}</span>
            ))}
            {hashtags.length > 3 && (
              <span className="text-xs text-gray-400">+{hashtags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}

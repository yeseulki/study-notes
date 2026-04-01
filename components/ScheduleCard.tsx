import type { Schedule } from '@/types'
import { SUBJECT_COLORS } from '@/types'
import { Calendar } from 'lucide-react'

// ─── Type color map ────────────────────────────────────────────────────────
const TYPE_META: Record<string, { hex: string; short: string }> = {
  '지필평가': { hex: '#3b82f6', short: '지필' },
  '수행평가': { hex: '#22c55e', short: '수행' },
  '숙제':    { hex: '#f97316', short: '숙제' },
}

function getBadgeStyle(types: string[], isDday: boolean): React.CSSProperties {
  if (isDday) return { backgroundColor: '#ef4444' }

  const hexes = types.map(t => TYPE_META[t]?.hex).filter(Boolean) as string[]
  if (hexes.length === 0) return { backgroundColor: '#2563eb' }
  if (hexes.length === 1) return { backgroundColor: hexes[0] }
  if (hexes.length === 2)
    return { background: `linear-gradient(135deg, ${hexes[0]} 50%, ${hexes[1]} 50%)` }
  // 3 types — three-way diagonal split
  return {
    background: `linear-gradient(135deg, ${hexes[0]} 33.3%, ${hexes[1]} 33.3% 66.6%, ${hexes[2]} 66.6%)`,
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function getDday(dateStr: string): { label: string; urgent: boolean } {
  const today  = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0)
  const diff   = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return { label: 'D-DAY', urgent: true }
  if (diff < 0)  return { label: `D+${Math.abs(diff)}`, urgent: false }
  return { label: `D-${diff}`, urgent: diff <= 7 }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

// ─── Component ─────────────────────────────────────────────────────────────
export default function ScheduleCard({ schedule }: { schedule: Schedule }) {
  const { label, urgent } = getDday(schedule.exam_date)
  const colorClass = SUBJECT_COLORS[schedule.subject] ?? 'bg-gray-100 text-gray-700'
  const weekday    = WEEKDAY[new Date(schedule.exam_date).getDay()]
  const types      = Array.isArray(schedule.types) ? schedule.types : []
  const isDday     = label === 'D-DAY'

  // Short type labels shown inside the badge  e.g. "지필/수행"
  const shortLabel = types.map(t => TYPE_META[t]?.short ?? t).join('/')

  return (
    <div className={`bg-white rounded-2xl border p-4 flex items-center gap-4 shadow-sm ${urgent ? 'border-red-200' : 'border-gray-200'}`}>

      {/* D-day badge */}
      <div
        style={getBadgeStyle(types, isDday)}
        className="flex-shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center font-bold text-white overflow-hidden"
      >
        {shortLabel && (
          <span className="text-[10px] font-semibold opacity-90 leading-tight px-1 text-center">
            {shortLabel}
          </span>
        )}
        <span className={`leading-tight font-bold ${isDday ? 'text-base' : 'text-lg'}`}>
          {label}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-gray-900 truncate text-base">{schedule.title}</h3>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>
            {schedule.subject}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Calendar size={11} />
            {formatDate(schedule.exam_date)} ({weekday})
          </span>
        </div>
        {schedule.description && (
          <p className="text-xs text-gray-500 mt-1 truncate">{schedule.description}</p>
        )}
      </div>
    </div>
  )
}

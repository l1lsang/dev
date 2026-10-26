const dateTime = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

const dateOnly = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
const monthDay = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' })
const shortDate = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' })
const time = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' })
const relative = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' })

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
export const formatDate = (iso: string) => dateOnly.format(new Date(iso))
export const formatShortDate = (iso: string) => shortDate.format(new Date(iso))
export const formatTime = (iso: string) => time.format(new Date(iso))

export function formatRelative(iso: string): string {
  const diffSec = (new Date(iso).getTime() - Date.now()) / 1000
  const abs = Math.abs(diffSec)
  if (abs < 60) return '방금 전'
  if (abs < 3600) return relative.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return relative.format(Math.round(diffSec / 3600), 'hour')
  if (abs < 86400 * 7) return relative.format(Math.round(diffSec / 86400), 'day')
  return formatDate(iso)
}

export function formatMinutes(min: number): string {
  const m = Math.round(min)
  if (m < 1) return '1분 미만'
  if (m < 60) return `${m}분`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h}시간 ${rest}분` : `${h}시간`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

/** 그 주 월요일(로컬 시간 기준) YYYY-MM-DD */
export function weekStartOf(date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dow = d.getDay() // 0 = 일요일
  d.setDate(d.getDate() - ((dow + 6) % 7))
  return toIsoDate(d)
}

export function shiftWeek(weekStart: string, weeks: number): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  const date = new Date(y, m - 1, d + weeks * 7)
  return toIsoDate(date)
}

export function formatWeekRange(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const end = new Date(y, m - 1, d + 6)
  return `${monthDay.format(start)} – ${monthDay.format(end)}`
}

function toIsoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function initials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  // 한글 이름은 성을 뺀 두 글자, 영문은 머리글자 두 개
  if (/^[가-힣]+$/.test(trimmed)) return trimmed.length > 2 ? trimmed.slice(-2) : trimmed
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function normalizeUrl(value: string): string {
  const v = value.trim()
  if (!v) return ''
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}

export function isValidUrl(value: string): boolean {
  try {
    const u = new URL(normalizeUrl(value))
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

/** 로그인 뒤 이동할 경로: 같은 사이트 안의 경로만 허용 */
export function safeNext(value: string | null): string {
  if (!value || !/^\/(?![/\\])/.test(value)) return '/'
  return value
}

/** 확인 대화상자 제목에 넣을 짧은 인용 */
export function snippet(text: string, max = 24): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

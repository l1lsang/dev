import { X } from 'lucide-react'
import { useState } from 'react'

const SUGGESTIONS = [
  'TypeScript',
  'JavaScript',
  'React',
  'Next.js',
  'Vue',
  'Svelte',
  'Node.js',
  'NestJS',
  'Spring',
  'Kotlin',
  'Java',
  'Python',
  'Django',
  'FastAPI',
  'Go',
  'Rust',
  'Swift',
  'Flutter',
  'React Native',
  'PostgreSQL',
  'MySQL',
  'Supabase',
  'AWS',
  'Docker',
  'Kubernetes',
]

/** 기술 스택 입력: Enter나 쉼표로 추가, 빈 칸에서 Backspace로 마지막 항목 삭제 */
export function StackInput({
  id,
  value,
  onChange,
  max = 12,
  describedBy,
}: {
  id: string
  value: string[]
  onChange: (next: string[]) => void
  max?: number
  describedBy?: string
}) {
  const [draft, setDraft] = useState('')
  const listId = `${id}-suggestions`

  const add = (raw: string) => {
    const items = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (items.length === 0) return
    const next = [...value]
    for (const item of items) {
      if (next.length >= max) break
      if (!next.some((v) => v.toLowerCase() === item.toLowerCase())) next.push(item.slice(0, 30))
    }
    onChange(next)
    setDraft('')
  }

  return (
    <div className="stack-input">
      {value.length > 0 && (
        <ul className="stack-input-items" aria-label="추가한 기술">
          {value.map((item) => (
            <li key={item}>
              <button
                type="button"
                className="chip"
                aria-label={`${item} 빼기`}
                onClick={() => onChange(value.filter((v) => v !== item))}
              >
                {item}
                <X size={14} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        className="input"
        value={draft}
        list={listId}
        placeholder={value.length >= max ? `최대 ${max}개까지 넣을 수 있어요` : 'React, Spring'}
        disabled={value.length >= max}
        aria-describedby={describedBy}
        onChange={(e) => {
          const v = e.target.value
          if (v.endsWith(',')) add(v)
          else setDraft(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add(draft)
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={() => add(draft)}
      />
      <datalist id={listId}>
        {SUGGESTIONS.filter((s) => !value.includes(s)).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  )
}

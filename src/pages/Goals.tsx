import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Target } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { addGoal, fetchGoals } from '../api/goals'
import { GoalRow } from '../components/GoalRow'
import { EmptyState, ErrorState, ListSkeleton } from '../components/states'
import { Button, IconButton, PageHeader } from '../components/ui'
import { useAuth, useToast } from '../lib/contexts'
import { formatWeekRange, shiftWeek, weekStartOf } from '../lib/format'
import { useLocalState } from '../lib/hooks'

function Composer({ weekStart, onAdded }: { weekStart: string; onAdded: () => void }) {
  const toast = useToast()
  const [body, setBody] = useLocalState(`draft:goal:${weekStart}`, '')
  const [error, setError] = useState<string | null>(null)
  const add = useMutation({
    mutationFn: () => addGoal(weekStart, body.trim()),
    onSuccess: () => {
      setBody('')
      onAdded()
    },
    onError: (e) => toast.error('목표를 올리지 못했어요. 쓴 내용은 그대로 있어요. 다시 시도해 주세요.', e),
  })

  return (
    <form
      className="panel panel-body goal-composer"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!body.trim()) {
          setError('이번 주에 할 일을 한 줄로 적어 주세요.')
          return
        }
        add.mutate()
      }}
    >
      <label className="field-label" htmlFor="goal-body">
        이번 주 내 목표
      </label>
      <div className="goal-composer-row">
        <input
          id="goal-body"
          className="input"
          value={body}
          maxLength={140}
          placeholder="NestJS 공식 문서 Fundamentals 끝까지 읽기"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'goal-error' : 'goal-hint'}
          onFocus={() => setError(null)}
          onChange={(e) => {
            setBody(e.target.value)
            setError(null)
          }}
        />
        <Button type="submit" variant="primary" loading={add.isPending}>
          목표 올리기
        </Button>
      </div>
      {error ? (
        <p id="goal-error" className="field-error" role="alert">
          {error}
        </p>
      ) : (
        <p id="goal-hint" className="field-hint">
          끝났는지 스스로 판단할 수 있게 구체적으로 적으면 좋아요. 140자까지.
        </p>
      )}
    </form>
  )
}

export default function Goals() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const thisWeek = weekStartOf()
  const week = /^\d{4}-\d{2}-\d{2}$/.test(params.get('week') ?? '') ? (params.get('week') as string) : thisWeek
  const isThisWeek = week === thisWeek

  const q = useQuery({ queryKey: ['goals', week], queryFn: () => fetchGoals(week) })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['goals'] })

  const goWeek = (w: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (w === thisWeek) next.delete('week')
        else next.set('week', w)
        return next
      },
      { replace: true },
    )

  const doneCount = q.data?.filter((g) => g.done).length ?? 0

  return (
    <div className="page page-read">
      <PageHeader
        title="주간 목표"
        description="이번 주에 할 일 하나를 적고 서로 응원해요. 매주 월요일에 새로 시작해요."
      />

      <div className="week-nav">
        <IconButton label="이전 주" icon={<ChevronLeft size={20} strokeWidth={1.75} />} bordered onClick={() => goWeek(shiftWeek(week, -1))} />
        <p className="week-label">
          <span>{formatWeekRange(week)}</span>
          {isThisWeek && <span className="meta">이번 주</span>}
        </p>
        <IconButton
          label="다음 주"
          icon={<ChevronRight size={20} strokeWidth={1.75} />}
          bordered
          disabled={isThisWeek}
          onClick={() => goWeek(shiftWeek(week, 1))}
        />
        {!isThisWeek && (
          <Button variant="ghost" onClick={() => goWeek(thisWeek)}>
            이번 주로 가기
          </Button>
        )}
        {q.data && q.data.length > 0 && (
          <p className="meta week-summary">
            {q.data.length}개 중 {doneCount}개 완료
          </p>
        )}
      </div>

      {isThisWeek &&
        (user ? (
          <Composer weekStart={week} onAdded={refresh} />
        ) : (
          <div className="notice">
            <Target size={16} strokeWidth={1.75} aria-hidden="true" />
            <p>
              <Link to="/login?next=/goals" className="text-link">
                로그인
              </Link>
              하면 이번 주 목표를 올리고 다른 멤버를 응원할 수 있어요.
            </p>
          </div>
        ))}

      <section className="panel feed" aria-label={`${formatWeekRange(week)} 목표`}>
        {q.isPending ? (
          <ListSkeleton rows={4} />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.data.length === 0 ? (
          <EmptyState
            icon={<Target size={24} strokeWidth={1.75} />}
            title={isThisWeek ? '이번 주 첫 목표를 올려 주세요' : '이 주에는 올라온 목표가 없어요'}
            body={isThisWeek ? '먼저 올린 목표가 다른 멤버들에게 시작할 계기가 돼요.' : '이번 주로 돌아가서 새 목표를 올려 보세요.'}
            actions={
              isThisWeek ? (
                user ? (
                  <Button variant="primary" onClick={() => document.getElementById('goal-body')?.focus()}>
                    목표 쓰기
                  </Button>
                ) : (
                  <Link to="/login?next=/goals" className="btn btn-primary">
                    로그인하고 목표 쓰기
                  </Link>
                )
              ) : (
                <Button variant="secondary" onClick={() => goWeek(thisWeek)}>
                  이번 주로 가기
                </Button>
              )
            }
          />
        ) : (
          <ul className="divided">
            {q.data.map((g) => (
              <GoalRow key={g.id} goal={g} onChanged={refresh} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

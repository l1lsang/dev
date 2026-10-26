import { useMutation } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import { setCheer, setGoalDone, deleteGoal } from '../api/goals'
import { useAuth, useConfirm, useToast } from '../lib/contexts'
import { formatRelative, snippet } from '../lib/format'
import type { Goal } from '../lib/types'
import { Avatar, Button, IconButton } from './ui'

export function GoalRow({ goal, onChanged }: { goal: Goal; onChanged: () => void }) {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const mine = user?.id === goal.user_id
  const cheered = Boolean(user && goal.cheers.some((c) => c.user_id === user.id))

  const cheer = useMutation({
    mutationFn: () => setCheer(goal.id, user!.id, !cheered),
    onSuccess: onChanged,
    onError: (e) => toast.error('응원을 남기지 못했어요. 다시 눌러 주세요.', e),
  })
  const done = useMutation({
    mutationFn: (next: boolean) => setGoalDone(goal.id, next),
    onSuccess: onChanged,
    onError: (e) => toast.error('완료 표시를 저장하지 못했어요. 다시 시도해 주세요.', e),
  })

  const remove = async () => {
    const ok = await confirm({
      title: `목표 “${snippet(goal.body)}”를 삭제할까요?`,
      body: `받은 응원 ${goal.cheers.length}개도 함께 지워져요.`,
      confirmLabel: '목표 삭제',
    })
    if (!ok) return
    try {
      await deleteGoal(goal.id)
      onChanged()
    } catch (e) {
      toast.error('목표를 삭제하지 못했어요. 다시 시도해 주세요.', e)
    }
  }

  return (
    <li className={`feed-row${goal.done ? ' is-done' : ''}`}>
      <Avatar profile={goal.author} />
      <div className="feed-main">
        <p className="feed-head">
          <Link to={`/u/${goal.author.handle}`} className="row-title">
            {goal.author.display_name}
          </Link>
          <span className={`status${goal.done ? ' is-on' : ''}`}>{goal.done ? '해냈어요' : '진행 중'}</span>
        </p>
        <p className="feed-body">{goal.body}</p>
        <div className="feed-actions">
          {mine ? (
            <label className="check-row feed-check">
              <input type="checkbox" checked={goal.done} disabled={done.isPending} onChange={(e) => done.mutate(e.target.checked)} />
              <span className="check-row-title">완료로 표시</span>
            </label>
          ) : null}
          {user && !mine ? (
            <Button variant={cheered ? 'secondary' : 'ghost'} aria-pressed={cheered} loading={cheer.isPending} onClick={() => cheer.mutate()}>
              {cheered ? '응원했어요' : '응원하기'}
              <span className="num">{goal.cheers.length}</span>
            </Button>
          ) : (
            <span className="meta">응원 {goal.cheers.length}</span>
          )}
          {mine && (
            <IconButton label="목표 삭제" icon={<Trash2 size={18} strokeWidth={1.75} />} onClick={remove} />
          )}
        </div>
      </div>
      <time className="meta feed-time" dateTime={goal.created_at}>
        {formatRelative(goal.created_at)}
      </time>
    </li>
  )
}

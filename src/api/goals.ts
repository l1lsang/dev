import { db, unwrap } from '../lib/supabase'
import type { Goal } from '../lib/types'
import { PROFILE_LITE } from './profiles'

// goal_cheers가 goals↔profiles 연결 테이블이기도 해서 FK를 명시한다
const GOAL_SELECT = `*, author:profiles!goals_user_id_fkey(${PROFILE_LITE}), cheers:goal_cheers(user_id)`

export async function fetchGoals(weekStart: string, limit = 200): Promise<Goal[]> {
  return unwrap(
    await db()
      .from('goals')
      .select(GOAL_SELECT)
      .eq('week_start', weekStart)
      .order('created_at', { ascending: false })
      .limit(limit),
  ) as Goal[]
}

export async function fetchUserGoals(userId: string, limit = 30): Promise<Goal[]> {
  return unwrap(
    await db()
      .from('goals')
      .select(GOAL_SELECT)
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit),
  ) as Goal[]
}

export async function addGoal(weekStart: string, body: string) {
  unwrap(await db().from('goals').insert({ week_start: weekStart, body }))
}

export async function setGoalDone(id: string, done: boolean) {
  unwrap(await db().from('goals').update({ done }).eq('id', id))
}

export async function deleteGoal(id: string) {
  unwrap(await db().from('goals').delete().eq('id', id))
}

export async function setCheer(goalId: string, userId: string, on: boolean) {
  if (on) unwrap(await db().from('goal_cheers').insert({ goal_id: goalId, user_id: userId }))
  else unwrap(await db().from('goal_cheers').delete().eq('goal_id', goalId).eq('user_id', userId))
}

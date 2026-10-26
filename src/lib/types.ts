export type Profile = {
  id: string
  handle: string
  display_name: string
  job_role: string | null
  years: number | null
  bio: string | null
  stack: string[]
  github_url: string | null
  blog_url: string | null
  avatar_url: string | null
  area_label: string | null
  created_at: string
}

export type ProfileLite = Pick<Profile, 'id' | 'handle' | 'display_name' | 'avatar_url'>

export type MeetupTopic = 'mogakco' | 'study' | 'project' | 'networking' | 'reading'

export type Meetup = {
  id: string
  title: string
  summary: string
  description: string | null
  topic: MeetupTopic
  cadence: string
  area_label: string | null
  capacity: number | null
  is_open: boolean
  host_id: string
  created_at: string
}

export type MeetupRow = Meetup & {
  member_count: number
  next_session: string | null
}

export type MeetupMember = {
  meetup_id: string
  user_id: string
  role: 'host' | 'member'
  joined_at: string
  profile: ProfileLite & Pick<Profile, 'job_role' | 'area_label'>
}

export type MeetupSession = {
  id: string
  meetup_id: string
  starts_at: string
  place_name: string
  place_lat: number | null
  place_lng: number | null
  note: string | null
  created_at: string
}

export type SessionWithRsvps = MeetupSession & {
  rsvps: { user_id: string; status: 'going' | 'not_going' }[]
}

export type UpcomingSession = MeetupSession & {
  meetup: Pick<Meetup, 'id' | 'title'>
}

export type MemberLocation = {
  user_id: string
  handle: string
  display_name: string
  area_label: string | null
  lat: number
  lng: number
}

export type PostCategory = 'question' | 'share' | 'retro' | 'career'

export type Post = {
  id: string
  author_id: string
  category: PostCategory
  title: string
  body: string
  created_at: string
  updated_at: string
  author: ProfileLite
}

export type PostRow = Omit<Post, 'body'> & { comment_count: number }

export type Comment = {
  id: string
  post_id: string
  author_id: string
  body: string
  created_at: string
  author: ProfileLite
}

export type Goal = {
  id: string
  user_id: string
  week_start: string
  body: string
  done: boolean
  created_at: string
  author: ProfileLite
  cheers: { user_id: string }[]
}

export type Portfolio = {
  id: string
  user_id: string
  title: string
  summary: string
  body: string | null
  live_url: string | null
  repo_url: string | null
  stack: string[]
  cover_path: string | null
  created_at: string
  updated_at: string
  author: ProfileLite
}

export type Resume = {
  user_id: string
  file_path: string
  file_name: string
  file_size: number
  visibility: 'private' | 'members'
  wants_feedback: boolean
  updated_at: string
}

export type ResumeFeedback = {
  id: string
  resume_user_id: string
  author_id: string
  body: string
  created_at: string
  author: ProfileLite
}

export type PersonRow = Profile & { portfolio_count: number }

export type Page<T> = { rows: T[]; total: number }

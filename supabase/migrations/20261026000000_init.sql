-- =====================================================================
-- 커밋테이블 초기 스키마
-- Supabase 대시보드 > SQL Editor에 통째로 붙여넣고 실행하거나
-- Supabase CLI에서 `supabase db push`로 적용하세요.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 공용 트리거 함수
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- ---------------------------------------------------------------------
-- profiles: auth.users 1:1, 공개 프로필
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  handle      text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  job_role    text check (char_length(job_role) <= 30),
  years       smallint check (years between 0 and 50),
  bio         text check (char_length(bio) <= 500),
  stack       text[] not null default '{}' check (cardinality(stack) <= 15),
  github_url  text check (char_length(github_url) <= 200),
  blog_url    text check (char_length(blog_url) <= 200),
  avatar_url  text,
  -- 공개되는 지역 이름(예: "마포구 망원동"). 좌표는 member_locations에 따로 둔다.
  area_label  text check (char_length(area_label) <= 40),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 가입 시 프로필 자동 생성 (GitHub 로그인이면 아이디/아바타를 가져온다)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  base text;
  candidate text;
begin
  base := lower(coalesce(
    meta ->> 'user_name',
    meta ->> 'preferred_username',
    split_part(new.email, '@', 1),
    'dev'
  ));
  base := regexp_replace(base, '[^a-z0-9_]', '', 'g');
  if char_length(base) < 3 then
    base := base || 'dev';
  end if;
  base := left(base, 15);

  candidate := base;
  while exists (select 1 from public.profiles where handle = candidate) loop
    candidate := base || '_' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.profiles (id, handle, display_name, avatar_url, github_url)
  values (
    new.id,
    candidate,
    left(coalesce(
      nullif(meta ->> 'full_name', ''),
      nullif(meta ->> 'name', ''),
      nullif(meta ->> 'user_name', ''),
      candidate
    ), 40),
    meta ->> 'avatar_url',
    case
      when new.raw_app_meta_data ->> 'provider' = 'github' and meta ->> 'user_name' is not null
        then 'https://github.com/' || (meta ->> 'user_name')
    end
  );
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- member_locations: 만남 장소 계산용 좌표 (본인만 직접 조회 가능)
-- ---------------------------------------------------------------------
create table public.member_locations (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  updated_at timestamptz not null default now()
);

-- 집 위치가 그대로 저장되지 않도록 소수 셋째 자리(약 100m)로 반올림
create or replace function public.round_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.lat := round(new.lat::numeric, 3)::double precision;
  new.lng := round(new.lng::numeric, 3)::double precision;
  new.updated_at := now();
  return new;
end
$$;

create trigger member_locations_round
  before insert or update on public.member_locations
  for each row execute function public.round_location();

-- ---------------------------------------------------------------------
-- meetups: 정기 모임
-- ---------------------------------------------------------------------
create table public.meetups (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 2 and 60),
  summary     text not null check (char_length(summary) between 1 and 140),
  description text check (char_length(description) <= 4000),
  topic       text not null check (topic in ('mogakco', 'study', 'project', 'networking', 'reading')),
  cadence     text not null check (char_length(cadence) between 1 and 40),
  area_label  text check (char_length(area_label) <= 40),
  capacity    smallint check (capacity between 2 and 100),
  is_open     boolean not null default true,
  host_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index meetups_created_at_idx on public.meetups (created_at desc);

create table public.meetup_members (
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      text not null default 'member' check (role in ('host', 'member')),
  joined_at timestamptz not null default now(),
  primary key (meetup_id, user_id)
);

create index meetup_members_user_idx on public.meetup_members (user_id);

create table public.meetup_sessions (
  id         uuid primary key default gen_random_uuid(),
  meetup_id  uuid not null references public.meetups (id) on delete cascade,
  starts_at  timestamptz not null,
  place_name text not null check (char_length(place_name) between 1 and 80),
  place_lat  double precision,
  place_lng  double precision,
  note       text check (char_length(note) <= 500),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index meetup_sessions_starts_idx on public.meetup_sessions (starts_at);
create index meetup_sessions_meetup_idx on public.meetup_sessions (meetup_id, starts_at);

create table public.session_rsvps (
  session_id uuid not null references public.meetup_sessions (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status     text not null check (status in ('going', 'not_going')),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create trigger session_rsvps_updated_at
  before update on public.session_rsvps
  for each row execute function public.set_updated_at();

-- 모임장은 자동으로 멤버(host)가 된다
create or replace function public.add_host_as_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.meetup_members (meetup_id, user_id, role)
  values (new.id, new.host_id, 'host');
  return new;
end
$$;

create trigger meetups_add_host
  after insert on public.meetups
  for each row execute function public.add_host_as_member();

-- RLS 헬퍼 (정책 안에서 재귀 조회를 피하려고 security definer 사용)
create or replace function public.is_meetup_member(p_meetup uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.meetup_members
    where meetup_id = p_meetup and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_meetup_host(p_meetup uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.meetups
    where id = p_meetup and host_id = (select auth.uid())
  );
$$;

create or replace function public.meetup_has_room(p_meetup uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select m.is_open and (
      m.capacity is null
      or (select count(*) from public.meetup_members mm where mm.meetup_id = m.id) < m.capacity
    )
    from public.meetups m
    where m.id = p_meetup
  ), false);
$$;

-- 같은 모임 멤버끼리만 서로의 좌표를 볼 수 있다
create or replace function public.meetup_member_locations(p_meetup uuid)
returns table (
  user_id uuid,
  handle text,
  display_name text,
  area_label text,
  lat double precision,
  lng double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.handle, p.display_name, p.area_label, l.lat, l.lng
  from public.meetup_members mm
  join public.profiles p on p.id = mm.user_id
  join public.member_locations l on l.user_id = mm.user_id
  where mm.meetup_id = p_meetup
    and public.is_meetup_member(p_meetup)
  order by mm.joined_at;
$$;

revoke execute on function public.meetup_member_locations(uuid) from public, anon;
grant execute on function public.meetup_member_locations(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 게시판
-- ---------------------------------------------------------------------
create table public.posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  category   text not null check (category in ('question', 'share', 'retro', 'career')),
  title      text not null check (char_length(title) between 2 and 100),
  body       text not null check (char_length(body) between 1 and 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_created_at_idx on public.posts (created_at desc);

create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index comments_post_idx on public.comments (post_id, created_at);

-- ---------------------------------------------------------------------
-- 주간 목표 + 응원
-- ---------------------------------------------------------------------
create table public.goals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  body       text not null check (char_length(body) between 1 and 140),
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

create index goals_week_idx on public.goals (week_start desc, created_at desc);

create table public.goal_cheers (
  goal_id    uuid not null references public.goals (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (goal_id, user_id)
);

-- ---------------------------------------------------------------------
-- 포트폴리오
-- ---------------------------------------------------------------------
create table public.portfolios (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title      text not null check (char_length(title) between 2 and 80),
  summary    text not null check (char_length(summary) between 1 and 200),
  body       text check (char_length(body) <= 5000),
  live_url   text check (char_length(live_url) <= 300),
  repo_url   text check (char_length(repo_url) <= 300),
  stack      text[] not null default '{}' check (cardinality(stack) <= 12),
  cover_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index portfolios_created_at_idx on public.portfolios (created_at desc);
create index portfolios_user_idx on public.portfolios (user_id);

create trigger portfolios_updated_at
  before update on public.portfolios
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 이력서 (1인 1부) + 피드백
-- ---------------------------------------------------------------------
create table public.resumes (
  user_id        uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  file_path      text not null,
  file_name      text not null check (char_length(file_name) <= 200),
  file_size      integer not null check (file_size > 0 and file_size <= 10485760),
  visibility     text not null default 'private' check (visibility in ('private', 'members')),
  wants_feedback boolean not null default false,
  updated_at     timestamptz not null default now(),
  -- 피드백 요청은 멤버 공개일 때만 의미가 있다
  check (visibility = 'members' or wants_feedback = false)
);

create trigger resumes_updated_at
  before update on public.resumes
  for each row execute function public.set_updated_at();

create table public.resume_feedback (
  id             uuid primary key default gen_random_uuid(),
  resume_user_id uuid not null references public.resumes (user_id) on delete cascade,
  author_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body           text not null check (char_length(body) between 1 and 2000),
  created_at     timestamptz not null default now()
);

create index resume_feedback_resume_idx on public.resume_feedback (resume_user_id, created_at);

-- =====================================================================
-- 권한 + RLS
-- =====================================================================
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

alter table public.profiles         enable row level security;
alter table public.member_locations enable row level security;
alter table public.meetups          enable row level security;
alter table public.meetup_members   enable row level security;
alter table public.meetup_sessions  enable row level security;
alter table public.session_rsvps    enable row level security;
alter table public.posts            enable row level security;
alter table public.comments         enable row level security;
alter table public.goals            enable row level security;
alter table public.goal_cheers      enable row level security;
alter table public.portfolios       enable row level security;
alter table public.resumes          enable row level security;
alter table public.resume_feedback  enable row level security;

-- profiles
create policy "profiles: anyone can read" on public.profiles
  for select using (true);
create policy "profiles: owner updates" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- member_locations (본인만. 다른 멤버 좌표는 meetup_member_locations RPC로만)
create policy "locations: owner reads" on public.member_locations
  for select to authenticated using (user_id = (select auth.uid()));
create policy "locations: owner inserts" on public.member_locations
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "locations: owner updates" on public.member_locations
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "locations: owner deletes" on public.member_locations
  for delete to authenticated using (user_id = (select auth.uid()));

-- meetups
create policy "meetups: anyone can read" on public.meetups
  for select using (true);
create policy "meetups: signed-in users create as host" on public.meetups
  for insert to authenticated with check (host_id = (select auth.uid()));
create policy "meetups: host updates" on public.meetups
  for update to authenticated
  using (host_id = (select auth.uid())) with check (host_id = (select auth.uid()));
create policy "meetups: host deletes" on public.meetups
  for delete to authenticated using (host_id = (select auth.uid()));

-- meetup_members
create policy "members: anyone can read" on public.meetup_members
  for select using (true);
create policy "members: join open meetups" on public.meetup_members
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'member'
    and public.meetup_has_room(meetup_id)
  );
create policy "members: leave or host removes" on public.meetup_members
  for delete to authenticated
  using (
    role <> 'host'
    and (user_id = (select auth.uid()) or public.is_meetup_host(meetup_id))
  );

-- meetup_sessions
create policy "sessions: anyone can read" on public.meetup_sessions
  for select using (true);
create policy "sessions: host creates" on public.meetup_sessions
  for insert to authenticated with check (public.is_meetup_host(meetup_id));
create policy "sessions: host updates" on public.meetup_sessions
  for update to authenticated
  using (public.is_meetup_host(meetup_id)) with check (public.is_meetup_host(meetup_id));
create policy "sessions: host deletes" on public.meetup_sessions
  for delete to authenticated using (public.is_meetup_host(meetup_id));

-- session_rsvps
create policy "rsvps: anyone can read" on public.session_rsvps
  for select using (true);
create policy "rsvps: members respond" on public.session_rsvps
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.meetup_sessions s
      where s.id = session_id and public.is_meetup_member(s.meetup_id)
    )
  );
create policy "rsvps: owner updates" on public.session_rsvps
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "rsvps: owner deletes" on public.session_rsvps
  for delete to authenticated using (user_id = (select auth.uid()));

-- posts / comments
create policy "posts: anyone can read" on public.posts
  for select using (true);
create policy "posts: author creates" on public.posts
  for insert to authenticated with check (author_id = (select auth.uid()));
create policy "posts: author updates" on public.posts
  for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "posts: author deletes" on public.posts
  for delete to authenticated using (author_id = (select auth.uid()));

create policy "comments: anyone can read" on public.comments
  for select using (true);
create policy "comments: author creates" on public.comments
  for insert to authenticated with check (author_id = (select auth.uid()));
create policy "comments: author deletes" on public.comments
  for delete to authenticated using (author_id = (select auth.uid()));

-- goals / cheers
create policy "goals: anyone can read" on public.goals
  for select using (true);
create policy "goals: owner creates" on public.goals
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "goals: owner updates" on public.goals
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "goals: owner deletes" on public.goals
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "cheers: anyone can read" on public.goal_cheers
  for select using (true);
create policy "cheers: owner creates" on public.goal_cheers
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "cheers: owner deletes" on public.goal_cheers
  for delete to authenticated using (user_id = (select auth.uid()));

-- portfolios
create policy "portfolios: anyone can read" on public.portfolios
  for select using (true);
create policy "portfolios: owner creates" on public.portfolios
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "portfolios: owner updates" on public.portfolios
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "portfolios: owner deletes" on public.portfolios
  for delete to authenticated using (user_id = (select auth.uid()));

-- resumes: 본인 또는 '멤버 공개'일 때 로그인 사용자만
create policy "resumes: owner or shared to members" on public.resumes
  for select to authenticated
  using (user_id = (select auth.uid()) or visibility = 'members');
create policy "resumes: owner creates" on public.resumes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "resumes: owner updates" on public.resumes
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "resumes: owner deletes" on public.resumes
  for delete to authenticated using (user_id = (select auth.uid()));

-- resume_feedback: 이력서를 볼 수 있는 사람만 읽고, 피드백 요청 중일 때만 작성
create policy "feedback: readable with the resume" on public.resume_feedback
  for select to authenticated
  using (exists (select 1 from public.resumes r where r.user_id = resume_user_id));
create policy "feedback: write while feedback is requested" on public.resume_feedback
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.resumes r
      where r.user_id = resume_user_id and r.wants_feedback
    )
  );
create policy "feedback: author or resume owner deletes" on public.resume_feedback
  for delete to authenticated
  using (author_id = (select auth.uid()) or resume_user_id = (select auth.uid()));

-- =====================================================================
-- Storage
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('resumes', 'resumes', false, 10485760, array['application/pdf']),
  ('portfolio-covers', 'portfolio-covers', true, 5242880,
    array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- 파일 경로 규칙: <user_id>/<파일명>
create policy "resumes: owner uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "resumes: owner deletes file" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "resumes: owner or members read file" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'resumes'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.resumes r
        where r.file_path = name and r.visibility = 'members'
      )
    )
  );

create policy "covers: anyone reads" on storage.objects
  for select using (bucket_id = 'portfolio-covers');
create policy "covers: owner uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'portfolio-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "covers: owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'portfolio-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

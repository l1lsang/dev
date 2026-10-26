import type { MeetupTopic, PostCategory } from './types'

export const SITE = {
  name: '커밋테이블',
  description: '가까운 개발자끼리 매주 오프라인에서 만나는 정기 모임 커뮤니티',
}

export const NAV = [
  { to: '/meetups', label: '모임' },
  { to: '/place', label: '장소 찾기' },
  { to: '/board', label: '게시판' },
  { to: '/goals', label: '주간 목표' },
  { to: '/showcase', label: '포트폴리오' },
  { to: '/people', label: '멤버' },
] as const

export const TOPICS: Record<MeetupTopic, string> = {
  mogakco: '모각코',
  study: '스터디',
  project: '사이드 프로젝트',
  networking: '네트워킹',
  reading: '기술 서적 읽기',
}

export const POST_CATEGORIES: Record<PostCategory, string> = {
  question: '질문',
  share: '정보 공유',
  retro: '회고',
  career: '커리어',
}

export const JOB_ROLES = [
  '프론트엔드',
  '백엔드',
  '풀스택',
  '모바일',
  '데이터·AI',
  'DevOps·인프라',
  '게임',
  '임베디드',
  'QA',
  '디자인·기획',
  '학생·취준',
]

export const PAGE_SIZE = 20

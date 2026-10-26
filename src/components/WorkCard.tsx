import { Link } from 'react-router'
import { coverUrl } from '../api/portfolios'
import type { Portfolio } from '../lib/types'

export function WorkCard({ work, showAuthor = true }: { work: Portfolio; showAuthor?: boolean }) {
  const cover = coverUrl(work.cover_path)
  return (
    <article className="work-card">
      <Link to={`/works/${work.id}`} className="work-card-link">
        <div className="work-cover">
          {cover ? (
            <img src={cover} alt="" loading="lazy" />
          ) : (
            <span className="work-cover-fallback" aria-hidden="true">
              {work.title}
            </span>
          )}
        </div>
        <div className="work-body">
          <h3 className="work-title">{work.title}</h3>
          <p className="secondary work-summary">{work.summary}</p>
          <p className="meta work-meta">
            {showAuthor && <span>{work.author.display_name}</span>}
            {work.stack.length > 0 && <span className="mono">{work.stack.slice(0, 3).join(' · ')}</span>}
          </p>
        </div>
      </Link>
    </article>
  )
}

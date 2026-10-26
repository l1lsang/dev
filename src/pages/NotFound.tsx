import { Link } from 'react-router'

export default function NotFound() {
  return (
    <div className="page page-narrow">
      <section className="empty not-found">
        <p className="meta mono">404</p>
        <h1>찾는 페이지가 없어요</h1>
        <p>주소가 바뀌었거나 삭제된 페이지예요.</p>
        <div className="empty-actions">
          <Link to="/" className="btn btn-primary">
            홈으로 가기
          </Link>
          <Link to="/meetups" className="btn btn-secondary">
            모임 둘러보기
          </Link>
        </div>
      </section>
    </div>
  )
}

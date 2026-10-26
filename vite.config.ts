import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Vercel에서는 api/*.ts가 서버리스 함수로 돈다.
 * 로컬 `npm run dev`에서도 같은 파일을 그대로 쓰도록 /api 요청을 넘겨준다.
 */
function localApi(): Plugin {
  return {
    name: 'local-vercel-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/([a-z-]+)(?:\?|$)/)
        if (!match) return next()
        try {
          const mod = await server.ssrLoadModule(`/api/${match[1]}.ts`)
          const handler = mod[req.method ?? 'GET'] as ((r: Request) => Promise<Response>) | undefined
          if (!handler) {
            res.statusCode = 405
            res.end()
            return
          }
          const response = await handler(new Request(new URL(req.url!, 'http://localhost')))
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (error) {
          next(error)
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // VITE_로 시작하지 않는 서버 전용 키(KAKAO_REST_API_KEY)는 브라우저 번들에 들어가지 않는다
  const env = loadEnv(mode, process.cwd(), '')
  if (env.KAKAO_REST_API_KEY && !process.env.KAKAO_REST_API_KEY) {
    process.env.KAKAO_REST_API_KEY = env.KAKAO_REST_API_KEY
  }
  return {
    plugins: [react(), localApi()],
  }
})

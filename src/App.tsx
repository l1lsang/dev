import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, type ReactElement } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { Layout, RequireAuth } from './components/Layout'
import { AuthProvider, ConfirmProvider, ToastProvider } from './components/Providers'
import { SetupRequiredError } from './lib/supabase'

const Home = lazy(() => import('./pages/Home'))
const Login = lazy(() => import('./pages/Login'))
const AuthCallback = lazy(() => import('./pages/AuthCallback'))
const Meetups = lazy(() => import('./pages/Meetups'))
const MeetupForm = lazy(() => import('./pages/MeetupForm'))
const MeetupDetail = lazy(() => import('./pages/MeetupDetail'))
const PlaceFinder = lazy(() => import('./pages/PlaceFinder'))
const Board = lazy(() => import('./pages/Board'))
const PostDetail = lazy(() => import('./pages/PostDetail'))
const PostForm = lazy(() => import('./pages/PostForm'))
const Goals = lazy(() => import('./pages/Goals'))
const Showcase = lazy(() => import('./pages/Showcase'))
const WorkDetail = lazy(() => import('./pages/WorkDetail'))
const PortfolioForm = lazy(() => import('./pages/PortfolioForm'))
const People = lazy(() => import('./pages/People'))
const Profile = lazy(() => import('./pages/Profile'))
const ProfileEdit = lazy(() => import('./pages/ProfileEdit'))
const NotFound = lazy(() => import('./pages/NotFound'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => !(error instanceof SetupRequiredError) && count < 1,
    },
  },
})

const authed = (el: ReactElement) => <RequireAuth>{el}</RequireAuth>

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/meetups', element: <Meetups /> },
      { path: '/meetups/new', element: authed(<MeetupForm />) },
      { path: '/meetups/:id', element: <MeetupDetail /> },
      { path: '/meetups/:id/edit', element: authed(<MeetupForm />) },
      { path: '/place', element: <PlaceFinder /> },
      { path: '/board', element: <Board /> },
      { path: '/board/new', element: authed(<PostForm />) },
      { path: '/board/:id', element: <PostDetail /> },
      { path: '/board/:id/edit', element: authed(<PostForm />) },
      { path: '/goals', element: <Goals /> },
      { path: '/showcase', element: <Showcase /> },
      { path: '/works/new', element: authed(<PortfolioForm />) },
      { path: '/works/:id', element: <WorkDetail /> },
      { path: '/works/:id/edit', element: authed(<PortfolioForm />) },
      { path: '/people', element: <People /> },
      { path: '/u/:handle', element: <Profile /> },
      { path: '/me/edit', element: authed(<ProfileEdit />) },
      { path: '*', element: <NotFound /> },
    ],
  },
  {
    path: '/login',
    element: (
      <Suspense>
        <Login />
      </Suspense>
    ),
  },
  {
    path: '/auth/callback',
    element: (
      <Suspense>
        <AuthCallback />
      </Suspense>
    ),
  },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}

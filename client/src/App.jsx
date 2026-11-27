import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { PageLoader } from './components/ui';
import { useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import { Login, Signup, AuthCallback, ForgotPassword, ResetPassword } from './pages/Auth';
import NotFound from './pages/NotFound';

const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard'));
const ClubDashboard = lazy(() => import('./pages/club/ClubDashboard'));
const EventForm = lazy(() => import('./pages/club/EventForm'));
const ManageEvent = lazy(() => import('./pages/club/ManageEvent'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const Scanner = lazy(() => import('./pages/Scanner'));

function RequireRole({ roles, children }) {
  const { user, status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Landing />} />
            <Route path="events" element={<Events />} />
            <Route path="events/:id" element={<EventDetail />} />
            <Route path="login" element={<Login />} />
            <Route path="signup" element={<Signup />} />
            <Route path="auth/callback" element={<AuthCallback />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route
              path="dashboard"
              element={
                <RequireRole roles={['student']}>
                  <StudentDashboard />
                </RequireRole>
              }
            />
            <Route
              path="club"
              element={
                <RequireRole roles={['club']}>
                  <ClubDashboard />
                </RequireRole>
              }
            />
            <Route
              path="club/events/new"
              element={
                <RequireRole roles={['club']}>
                  <EventForm />
                </RequireRole>
              }
            />
            <Route
              path="club/events/:id/edit"
              element={
                <RequireRole roles={['club', 'admin']}>
                  <EventForm />
                </RequireRole>
              }
            />
            <Route
              path="club/events/:id"
              element={
                <RequireRole roles={['club', 'admin']}>
                  <ManageEvent />
                </RequireRole>
              }
            />
            <Route
              path="admin"
              element={
                <RequireRole roles={['admin']}>
                  <AdminDashboard />
                </RequireRole>
              }
            />
            <Route
              path="scan"
              element={
                <RequireRole roles={['club', 'admin']}>
                  <Scanner />
                </RequireRole>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}

import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { ErrorState, Spinner } from '../components/ui';
import { VerifyPendingPage, NoWorkspacePage } from '../features/auth/AuthPages';

export function FullPageSpinner() {
  return <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}><Spinner /></div>;
}

/** Requires a session, a verified email and an active workspace. */
export function RequireAuth({ children }) {
  const { me, loading, error } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (error) return <ErrorState error={error} onRetry={() => window.location.reload()} />;
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (!me.user.email_verified) return <VerifyPendingPage />;
  if (!me.tenant) return <NoWorkspacePage />;
  return children;
}

/** UX gate only — the API enforces the same permission on every request. */
export function RequirePermission({ perm, children }) {
  const { can } = useAuth();
  const perms = [].concat(perm);
  if (!perms.some((p) => can(p))) return <ErrorState error={{ status: 403, message: `You need the ${perms.join(' or ')} permission to view this page.` }} />;
  return children;
}

export function RedirectIfAuthed({ children }) {
  const { me, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (me?.tenant && me.user.email_verified) return <Navigate to="/" replace />;
  return children;
}

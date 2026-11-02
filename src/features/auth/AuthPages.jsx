import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../../api/client';
import { AuthLayout } from '../../layouts/AuthLayout';
import { Alert, Button, TextField, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { passwordProblems } from '../../validators/auth';

function useFormErrors() {
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const handle = (err) => {
    setErrors(err.fieldErrors?.() || {});
    setMessage(err.details?.length && Object.keys(err.fieldErrors?.() || {}).length ? null : err.message);
  };
  return { errors, message, handle, reset: () => { setErrors({}); setMessage(null); }, setErrors };
}

export function LoginPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState(null);
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const f = useFormErrors();
  const done = async () => {
    await qc.invalidateQueries({ queryKey: ['me'] });
    navigate(sp.get('next')?.startsWith('/') ? sp.get('next') : '/', { replace: true });
  };
  const login = useMutation({
    mutationFn: () => post('/auth/login', { email, password }),
    onSuccess: (res) => (res.data.mfa_required ? setMfaToken(res.data.mfa_token) : done()),
    onError: f.handle,
  });
  const verify = useMutation({
    mutationFn: () => post('/auth/mfa/verify', { mfa_token: mfaToken, ...(useRecovery ? { recovery_code: code } : { code }) }),
    onSuccess: done,
    onError: f.handle,
  });
  if (mfaToken) {
    return (
      <AuthLayout title="Two-factor verification" subtitle={useRecovery ? 'Enter one of your recovery codes.' : 'Enter the 6-digit code from your authenticator app.'}>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); f.reset(); verify.mutate(); }}>
          {f.message && <Alert tone="danger">{f.message}</Alert>}
          <TextField label={useRecovery ? 'Recovery code' : 'Verification code'} value={code} onChange={(e) => setCode(e.target.value.trim())} autoComplete="one-time-code" inputMode={useRecovery ? 'text' : 'numeric'} autoFocus required />
          <Button type="submit" variant="primary" loading={verify.isPending}>Verify</Button>
          <Button variant="ghost" onClick={() => { setUseRecovery((r) => !r); setCode(''); }}>{useRecovery ? 'Use authenticator code' : 'Use a recovery code'}</Button>
        </form>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title="Sign in" subtitle="Welcome back. Sign in to your workspace.">
      <form className="stack" onSubmit={(e) => { e.preventDefault(); f.reset(); login.mutate(); }}>
        {sp.get('reset') && <Alert tone="success">Password updated. Sign in with your new password.</Alert>}
        {f.message && <Alert tone="danger">{f.message}</Alert>}
        <TextField label="Work email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={f.errors.email} required autoFocus />
        <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={f.errors.password} required />
        <div className="row between"><Link to="/forgot-password" className="small">Forgot password?</Link></div>
        <Button type="submit" variant="primary" loading={login.isPending}>Sign in</Button>
        <p className="small muted center">New here? <Link to="/register">Create a workspace</Link></p>
      </form>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [v, setV] = useState({ company_name: '', first_name: '', last_name: '', email: '', password: '' });
  const f = useFormErrors();
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const reg = useMutation({
    mutationFn: () => post('/auth/register', v),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['me'] }); navigate('/', { replace: true }); },
    onError: f.handle,
  });
  const problems = passwordProblems(v.password, v.email);
  return (
    <AuthLayout title="Create your workspace" subtitle="Start a free 14-day trial. No credit card required.">
      <form className="stack" onSubmit={(e) => { e.preventDefault(); f.reset(); if (problems.length) return f.setErrors({ password: problems[0] }); reg.mutate(); }}>
        {f.message && <Alert tone="danger">{f.message}</Alert>}
        <TextField label="Company name" value={v.company_name} onChange={set('company_name')} error={f.errors.company_name} required autoFocus />
        <div className="grid cols-2">
          <TextField label="First name" value={v.first_name} onChange={set('first_name')} error={f.errors.first_name} autoComplete="given-name" required />
          <TextField label="Last name" value={v.last_name} onChange={set('last_name')} error={f.errors.last_name} autoComplete="family-name" />
        </div>
        <TextField label="Work email" type="email" value={v.email} onChange={set('email')} error={f.errors.email} autoComplete="email" required />
        <TextField label="Password" type="password" value={v.password} onChange={set('password')} error={f.errors.password} autoComplete="new-password" hint="At least 10 characters. Long passphrases are best." required />
        <Button type="submit" variant="primary" loading={reg.isPending}>Create workspace</Button>
        <p className="small muted center">Already have an account? <Link to="/login">Sign in</Link></p>
      </form>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const m = useMutation({ mutationFn: () => post('/auth/forgot-password', { email }) });
  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a link to choose a new password.">
      {m.isSuccess ? <Alert tone="success">If an account exists for {email}, a reset link is on its way. The link expires in 60 minutes.</Alert> : (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          {m.error && <Alert tone="danger">{m.error.message}</Alert>}
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <Button type="submit" variant="primary" loading={m.isPending}>Send reset link</Button>
        </form>
      )}
      <Link to="/login" className="small">Back to sign in</Link>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const f = useFormErrors();
  const m = useMutation({ mutationFn: () => post('/auth/reset-password', { token: sp.get('token'), password }), onSuccess: () => navigate('/login?reset=1'), onError: f.handle });
  const problems = passwordProblems(password);
  return (
    <AuthLayout title="Choose a new password" subtitle="All other sessions will be signed out.">
      <form className="stack" onSubmit={(e) => { e.preventDefault(); f.reset(); if (problems.length) return f.setErrors({ password: problems[0] }); if (password !== confirm) return f.setErrors({ confirm: 'Passwords do not match' }); m.mutate(); }}>
        {f.message && <Alert tone="danger">{f.message}</Alert>}
        <TextField label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={f.errors.password} required />
        <TextField label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={f.errors.confirm} required />
        <Button type="submit" variant="primary" loading={m.isPending}>Update password</Button>
      </form>
    </AuthLayout>
  );
}

export function VerifyEmailPage() {
  const [sp] = useSearchParams();
  const qc = useQueryClient();
  const m = useMutation({ mutationFn: () => post('/auth/verify-email', { token: sp.get('token') }), onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }) });
  // Single-use token: submit exactly once (StrictMode runs effects twice in development).
  const submitted = useRef(false);
  useEffect(() => {
    if (sp.get('token') && !submitted.current) {
      submitted.current = true;
      m.mutate();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AuthLayout title="Email verification">
      {m.isPending && <Spinner label="Verifying…" />}
      {m.isSuccess && <><Alert tone="success">Your email address is verified.</Alert><Link to="/" className="btn primary">Continue to your workspace</Link></>}
      {m.isError && <Alert tone="danger">{m.error.message}</Alert>}
    </AuthLayout>
  );
}

export function VerifyPendingPage() {
  const { me, logout } = useAuth();
  const m = useMutation({ mutationFn: () => post('/auth/resend-verification') });
  return (
    <AuthLayout title="Check your inbox" subtitle={`We sent a verification link to ${me?.user?.email}. Click it to activate your workspace.`}>
      {m.isSuccess && <Alert tone="success">A new link has been sent.</Alert>}
      <Button onClick={() => m.mutate()} loading={m.isPending}>Resend verification email</Button>
      <Button variant="ghost" onClick={logout}>Sign out</Button>
      <p className="small subtle">Development: with MAIL_TRANSPORT=log the link is printed in the API console.</p>
    </AuthLayout>
  );
}

export function AcceptInvitePage() {
  const [sp] = useSearchParams();
  const token = sp.get('token');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { me } = useAuth();
  const [v, setV] = useState({ first_name: '', last_name: '', password: '' });
  const f = useFormErrors();
  const preview = useQuery({ queryKey: ['invite', token], queryFn: () => get(`/auth/invitations/${token}`).then((r) => r.data), enabled: !!token, retry: false });
  const accept = useMutation({
    mutationFn: () => post('/auth/invitations/accept', preview.data?.account_exists ? { token } : { token, ...v }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['me'] }); navigate('/', { replace: true }); },
    onError: f.handle,
  });
  if (preview.isLoading) return <AuthLayout title="Invitation"><Spinner /></AuthLayout>;
  if (preview.isError) return <AuthLayout title="Invitation"><Alert tone="danger">{preview.error.message}</Alert><Link to="/login">Go to sign in</Link></AuthLayout>;
  const p = preview.data;
  if (p.account_exists && (!me || me.user.email !== p.email)) {
    return (
      <AuthLayout title={`Join ${p.tenant.name}`} subtitle={`This invitation is for ${p.email}.`}>
        <Alert>Sign in as {p.email} to accept the invitation.</Alert>
        <Link className="btn primary" to={`/login?next=${encodeURIComponent(`/accept-invite?token=${token}`)}`}>Sign in to accept</Link>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title={`Join ${p.tenant.name}`} subtitle={p.account_exists ? `Accept the invitation as ${p.email}.` : `Create your account for ${p.email}.`}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); f.reset(); accept.mutate(); }}>
        {f.message && <Alert tone="danger">{f.message}</Alert>}
        {!p.account_exists && <>
          <div className="grid cols-2">
            <TextField label="First name" value={v.first_name} onChange={(e) => setV({ ...v, first_name: e.target.value })} required />
            <TextField label="Last name" value={v.last_name} onChange={(e) => setV({ ...v, last_name: e.target.value })} />
          </div>
          <TextField label="Password" type="password" autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} error={f.errors.password} required />
        </>}
        <Button type="submit" variant="primary" loading={accept.isPending}>Accept invitation</Button>
      </form>
    </AuthLayout>
  );
}

export function NoWorkspacePage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const { logout } = useAuth();
  const m = useMutation({ mutationFn: () => post('/auth/workspaces', { company_name: name }), onSuccess: () => { qc.clear(); window.location.assign('/'); } });
  return (
    <AuthLayout title="Create a workspace" subtitle="You are not a member of any active workspace.">
      <form className="stack" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        {m.error && <Alert tone="danger">{m.error.message}</Alert>}
        <TextField label="Company name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Button type="submit" variant="primary" loading={m.isPending}>Create workspace</Button>
        <Button variant="ghost" onClick={logout}>Sign out</Button>
      </form>
    </AuthLayout>
  );
}

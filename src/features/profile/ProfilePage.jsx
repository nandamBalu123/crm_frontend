import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Laptop, ShieldCheck } from 'lucide-react';
import { get, post, patch, put, del } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Alert, Badge, Button, Card, Checkbox, PageHeader, TextField } from '../../components/ui';
import { relative } from '../../utils/format';
import { passwordProblems } from '../../validators/auth';

function MfaCard() {
  const { me, refresh } = useAuth();
  const toast = useToast();
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState(null);
  const [disable, setDisable] = useState({ password: '', code: '' });
  const start = useMutation({ mutationFn: () => post('/auth/mfa/setup').then((r) => r.data), onSuccess: setSetup, onError: (e) => toast.error(e) });
  const enable = useMutation({ mutationFn: () => post('/auth/mfa/enable', { code }).then((r) => r.data), onSuccess: (d) => { setCodes(d.recovery_codes); setSetup(null); refresh(); }, onError: (e) => toast.error(e) });
  const off = useMutation({ mutationFn: () => post('/auth/mfa/disable', disable), onSuccess: () => { toast.success('MFA disabled'); refresh(); }, onError: (e) => toast.error(e) });
  return (
    <Card title={<span className="row tight"><ShieldCheck size={18} /><h3>Two-factor authentication</h3>{me.user.mfa_enabled ? <Badge tone="success">On</Badge> : <Badge>Off</Badge>}</span>}>
      {codes && <div className="stack" style={{ marginBottom: 12 }}><Alert tone="warning">Save these recovery codes somewhere safe. Each can be used once if you lose your device.</Alert><pre className="mono card card-body">{codes.join('\n')}</pre></div>}
      {!me.user.mfa_enabled && !setup && <Button variant="primary" onClick={() => start.mutate()} loading={start.isPending}>Set up authenticator app</Button>}
      {setup && (
        <div className="stack">
          <p>Add this account to your authenticator app (Google Authenticator, 1Password, Authy…) using the setup key, then enter the 6-digit code.</p>
          <TextField label="Setup key" value={setup.secret} readOnly className="mono" />
          <a href={setup.otpauth_url} className="small">Open in authenticator app</a>
          <TextField label="Verification code" value={code} onChange={(e) => setCode(e.target.value.trim())} inputMode="numeric" autoComplete="one-time-code" />
          <Button variant="primary" disabled={code.length !== 6} loading={enable.isPending} onClick={() => enable.mutate()}>Enable MFA</Button>
        </div>
      )}
      {me.user.mfa_enabled && !codes && (
        <form className="grid cols-3" onSubmit={(e) => { e.preventDefault(); off.mutate(); }}>
          <TextField type="password" label="Password" value={disable.password} onChange={(e) => setDisable({ ...disable, password: e.target.value })} />
          <TextField label="Current code" value={disable.code} onChange={(e) => setDisable({ ...disable, code: e.target.value })} />
          <div className="field" style={{ paddingTop: 20 }}><Button type="submit" variant="danger" loading={off.isPending}>Disable MFA</Button></div>
        </form>
      )}
    </Card>
  );
}

export function ProfilePage() {
  const { me, refresh } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [p, setP] = useState({ first_name: me.user.first_name, last_name: me.user.last_name, phone: me.user.phone || '', timezone: me.user.timezone || '' });
  const [pw, setPw] = useState({ current_password: '', new_password: '' });
  const saveProfile = useMutation({ mutationFn: () => patch('/auth/me', { ...p, phone: p.phone || null, timezone: p.timezone || null }), onSuccess: () => { toast.success('Profile updated'); refresh(); }, onError: (e) => toast.error(e) });
  const changePw = useMutation({ mutationFn: () => post('/auth/change-password', pw), onSuccess: () => { toast.success('Password changed. Other sessions were signed out.'); setPw({ current_password: '', new_password: '' }); qc.invalidateQueries({ queryKey: ['sessions'] }); }, onError: (e) => toast.error(e) });
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => get('/auth/sessions').then((r) => r.data) });
  const revoke = useMutation({ mutationFn: (id) => del(`/auth/sessions/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }) });
  const prefs = useQuery({ queryKey: ['notif-prefs'], queryFn: () => get('/me/notification-preferences').then((r) => r.data), enabled: !!me.tenant });
  const [pv, setPv] = useState(null);
  useEffect(() => { if (prefs.data) setPv(prefs.data); }, [prefs.data]);
  const savePrefs = useMutation({ mutationFn: () => put('/me/notification-preferences', { preferences: pv.map(({ type, in_app, email }) => ({ type, in_app, email })) }), onSuccess: () => toast.success('Preferences saved') });
  const problems = pw.new_password ? passwordProblems(pw.new_password, me.user.email) : [];
  return (
    <>
      <PageHeader title="Profile & security" subtitle={me.user.email} />
      <div className="grid cols-2">
        <Card title="Profile">
          <form className="stack" onSubmit={(e) => { e.preventDefault(); saveProfile.mutate(); }}>
            <div className="grid cols-2"><TextField label="First name" value={p.first_name} onChange={(e) => setP({ ...p, first_name: e.target.value })} /><TextField label="Last name" value={p.last_name} onChange={(e) => setP({ ...p, last_name: e.target.value })} /></div>
            <TextField label="Phone" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} />
            <TextField label="Time zone override" value={p.timezone} onChange={(e) => setP({ ...p, timezone: e.target.value })} hint="Leave blank to use the workspace time zone." />
            <div className="row end"><Button type="submit" variant="primary" loading={saveProfile.isPending}>Save profile</Button></div>
          </form>
        </Card>
        <Card title="Password">
          <form className="stack" onSubmit={(e) => { e.preventDefault(); changePw.mutate(); }}>
            <TextField type="password" autoComplete="current-password" label="Current password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
            <TextField type="password" autoComplete="new-password" label="New password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} error={problems[0]} />
            <div className="row end"><Button type="submit" variant="primary" disabled={!pw.current_password || problems.length > 0 || !pw.new_password} loading={changePw.isPending}>Change password</Button></div>
          </form>
        </Card>
        <MfaCard />
        <Card title="Active sessions" flush>
          <table className="table"><tbody>{(sessions.data || []).map((s) => (
            <tr key={s.id}><td><span className="row tight"><Laptop size={16} /><span className="truncate" style={{ maxWidth: 260 }}>{s.user_agent || 'Unknown device'}</span></span><div className="small subtle">{s.ip} · last used {relative(s.last_used_at)}</div></td>
              <td className="right">{s.current ? <Badge tone="success">This device</Badge> : <Button size="sm" onClick={() => revoke.mutate(s.id)}>Sign out</Button>}</td></tr>
          ))}</tbody></table>
        </Card>
        {pv && (
          <Card title="Notification preferences" flush>
            <table className="table"><thead><tr><th>Event</th><th>In-app</th><th>Email</th></tr></thead>
              <tbody>{pv.map((x, i) => <tr key={x.type}><td>{x.label}</td><td><Checkbox label="" aria-label={`${x.label} in-app`} checked={x.in_app} onChange={(e) => setPv(pv.map((y, j) => (j === i ? { ...y, in_app: e.target.checked } : y)))} /></td><td><Checkbox label="" aria-label={`${x.label} email`} checked={x.email} onChange={(e) => setPv(pv.map((y, j) => (j === i ? { ...y, email: e.target.checked } : y)))} /></td></tr>)}</tbody></table>
            <div className="card-body row end"><Button variant="primary" loading={savePrefs.isPending} onClick={() => savePrefs.mutate()}>Save preferences</Button></div>
          </Card>
        )}
      </div>
    </>
  );
}



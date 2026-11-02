import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, patch, post } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Alert, Badge, Button, Card, Checkbox, DescriptionList, Kpi, Skeleton, TextField } from '../../components/ui';
import { money, number, date } from '../../utils/format';

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: () => get('/settings').then((r) => r.data) });
}

function useSaveSettings() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (body) => patch('/settings', body),
    onSuccess: () => { toast.success('Settings saved'); qc.invalidateQueries({ queryKey: ['settings'] }); qc.invalidateQueries({ queryKey: ['me'] }); },
    onError: (e) => toast.error(e),
  });
}

const MODULES = ['leads', 'contacts', 'accounts', 'opportunities', 'activities', 'products', 'quotes', 'campaigns', 'forms', 'tickets', 'workflows', 'reports', 'integrations', 'api'];
const listToText = (l) => (l || []).join('\n');
const textToList = (t) => t.split('\n').map((s) => s.trim()).filter(Boolean);

export function GeneralSettings() {
  const s = useSettings();
  const save = useSaveSettings();
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [v, setV] = useState(null);
  useEffect(() => {
    if (s.data) setV({ name: s.data.tenant.name, locale: s.data.locale, timezone: s.data.timezone, currency: s.data.currency, date_format: s.data.date_format, fiscal_year_start_month: s.data.fiscal_year_start_month, modules: { ...s.data.modules }, lead_sources: listToText(s.data.preferences.lead_sources), industries: listToText(s.data.preferences.industries), loss_reasons: listToText(s.data.preferences.loss_reasons), quote_approval_discount_threshold: s.data.preferences.quote_approval_discount_threshold, stalled_deal_days: s.data.preferences.stalled_deal_days, audit_record_access: !!s.data.preferences.audit_record_access, audit_days: s.data.preferences.retention?.audit_days });
  }, [s.data]);
  const rename = useMutation({ mutationFn: (name) => patch('/settings/profile', { name }), onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }), onError: (e) => toast.error(e) });
  if (!v) return <Skeleton />;
  const editable = can('settings:manage');
  const submit = () => {
    if (v.name !== s.data.tenant.name) rename.mutate(v.name);
    save.mutate({
      locale: v.locale, timezone: v.timezone, currency: v.currency, date_format: v.date_format, fiscal_year_start_month: Number(v.fiscal_year_start_month), modules: v.modules,
      preferences: { lead_sources: textToList(v.lead_sources), industries: textToList(v.industries), loss_reasons: textToList(v.loss_reasons), quote_approval_discount_threshold: Number(v.quote_approval_discount_threshold), stalled_deal_days: Number(v.stalled_deal_days), audit_record_access: v.audit_record_access, retention: { audit_days: Number(v.audit_days) } },
    });
  };
  const set = (k) => (e) => setV({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Card title="Workspace">
        <div className="form-grid">
          <TextField label="Workspace name" value={v.name} onChange={set('name')} disabled={!editable} />
          <TextField label="Workspace URL slug" value={s.data.tenant.slug} disabled hint="Used for sign-in links." />
          <TextField label="Locale" value={v.locale} onChange={set('locale')} disabled={!editable} hint="e.g. en-US, de-DE" />
          <TextField label="Time zone" value={v.timezone} onChange={set('timezone')} disabled={!editable} hint="IANA zone, e.g. Europe/Berlin" />
          <TextField label="Default currency" value={v.currency} onChange={(e) => setV({ ...v, currency: e.target.value.toUpperCase() })} disabled={!editable} maxLength={3} />
          <TextField as="select" label="Date format" value={v.date_format} onChange={set('date_format')} disabled={!editable} options={['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy', 'dd.MM.yyyy']} />
          <TextField as="select" label="Fiscal year starts" value={v.fiscal_year_start_month} onChange={set('fiscal_year_start_month')} disabled={!editable} options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(2000, i, 1).toLocaleString(undefined, { month: 'long' }) }))} />
        </div>
      </Card>
      <Card title="Modules"><div className="grid cols-3">{MODULES.map((m) => <Checkbox key={m} label={m.replace('_', ' ')} checked={v.modules[m] !== false} disabled={!editable} onChange={(e) => setV({ ...v, modules: { ...v.modules, [m]: e.target.checked } })} />)}</div><p className="small subtle" style={{ marginTop: 8 }}>Modules must also be included in your plan.</p></Card>
      <Card title="Picklists & sales policy">
        <div className="form-grid">
          <TextField as="textarea" label="Lead sources (one per line)" value={v.lead_sources} onChange={set('lead_sources')} disabled={!editable} />
          <TextField as="textarea" label="Industries" value={v.industries} onChange={set('industries')} disabled={!editable} />
          <TextField as="textarea" label="Loss reasons" value={v.loss_reasons} onChange={set('loss_reasons')} disabled={!editable} />
          <div className="stack">
            <TextField type="number" label="Quote approval threshold (max discount %)" value={v.quote_approval_discount_threshold} onChange={set('quote_approval_discount_threshold')} disabled={!editable} />
            <TextField type="number" label="Stalled deal after (days)" value={v.stalled_deal_days} onChange={set('stalled_deal_days')} disabled={!editable} />
          </div>
        </div>
      </Card>
      <Card title="Compliance">
        <div className="form-grid">
          <TextField type="number" label="Audit log retention (days)" value={v.audit_days} onChange={set('audit_days')} disabled={!editable} min={30} />
          <div className="field" style={{ paddingTop: 22 }}><Checkbox label="Log record views (record-access audit)" checked={v.audit_record_access} onChange={set('audit_record_access')} disabled={!editable} /></div>
        </div>
      </Card>
      {editable && <div className="row end"><Button type="submit" variant="primary" loading={save.isPending}>Save settings</Button></div>}
    </form>
  );
}

export function BrandingSettings() {
  const s = useSettings();
  const save = useSaveSettings();
  const { can } = useAuth();
  const [b, setB] = useState(null);
  useEffect(() => { if (s.data) setB({ primary_color: '#4f46e5', accent_color: '#0ea5e9', logo_url: '', display_name: '', ...s.data.branding }); }, [s.data]);
  if (!b) return <Skeleton />;
  const editable = can('settings:manage');
  return (
    <Card title="Branding">
      <form className="stack" onSubmit={(e) => { e.preventDefault(); save.mutate({ branding: { ...b, logo_url: b.logo_url || null, display_name: b.display_name || null } }); }}>
        <div className="form-grid">
          <TextField label="Display name" value={b.display_name || ''} onChange={(e) => setB({ ...b, display_name: e.target.value })} disabled={!editable} hint="Shown in the sidebar, emails and quotes." />
          <TextField label="Logo URL (https)" value={b.logo_url || ''} onChange={(e) => setB({ ...b, logo_url: e.target.value })} disabled={!editable} />
          <TextField type="color" label="Primary colour" value={b.primary_color} onChange={(e) => setB({ ...b, primary_color: e.target.value })} disabled={!editable} />
          <TextField type="color" label="Accent colour" value={b.accent_color} onChange={(e) => setB({ ...b, accent_color: e.target.value })} disabled={!editable} />
        </div>
        <div className="row"><span className="badge" style={{ background: b.primary_color, color: '#fff' }}>Primary</span><span className="badge" style={{ background: b.accent_color, color: '#fff' }}>Accent</span></div>
        {editable && <div className="row end"><Button type="submit" variant="primary" loading={save.isPending}>Save branding</Button></div>}
      </form>
    </Card>
  );
}

export function SecuritySettings() {
  const s = useSettings();
  const save = useSaveSettings();
  const { can, me } = useAuth();
  const [v, setV] = useState(null);
  useEffect(() => { if (s.data) setV({ ...s.data.security, allowed_email_domains: (s.data.security.allowed_email_domains || []).join(', ') }); }, [s.data]);
  if (!v) return <Skeleton />;
  const editable = can('settings:manage') && (me.membership.is_owner || can('roles:manage'));
  return (
    <Card title="Security policy">
      <form className="stack" onSubmit={(e) => { e.preventDefault(); save.mutate({ security: { require_mfa: !!v.require_mfa, password_min_length: Number(v.password_min_length), session_max_hours: Number(v.session_max_hours), invite_expiry_days: Number(v.invite_expiry_days), allowed_email_domains: v.allowed_email_domains.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean) } }); }}>
        {v.require_mfa && !me.user.mfa_enabled && <Alert tone="warning">You have not enabled MFA yourself. Enable it in your profile first or you will be asked to on your next request.</Alert>}
        <Checkbox label="Require two-factor authentication for all members" checked={!!v.require_mfa} disabled={!editable} onChange={(e) => setV({ ...v, require_mfa: e.target.checked })} />
        <div className="form-grid">
          <TextField type="number" label="Minimum password length" min={10} max={128} value={v.password_min_length} disabled={!editable} onChange={(e) => setV({ ...v, password_min_length: e.target.value })} />
          <TextField type="number" label="Maximum session length (hours)" min={1} value={v.session_max_hours} disabled={!editable} onChange={(e) => setV({ ...v, session_max_hours: e.target.value })} />
          <TextField type="number" label="Invitation expiry (days)" min={1} max={30} value={v.invite_expiry_days} disabled={!editable} onChange={(e) => setV({ ...v, invite_expiry_days: e.target.value })} />
          <TextField label="Allowed invite email domains" value={v.allowed_email_domains} disabled={!editable} onChange={(e) => setV({ ...v, allowed_email_domains: e.target.value })} hint="Comma separated; empty allows any domain." />
        </div>
        <p className="small subtle">Single sign-on (SAML/OIDC) is on the roadmap; see docs/SECURITY.md.</p>
        {editable && <div className="row end"><Button type="submit" variant="primary" loading={save.isPending}>Save policy</Button></div>}
      </form>
    </Card>
  );
}

export function BillingSettings() {
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['subscription'], queryFn: () => get('/settings/subscription').then((r) => r.data) });
  const change = useMutation({
    mutationFn: (code) => post('/settings/subscription/change-plan', { plan_code: code }),
    onSuccess: (r) => { if (r.data.checkout_url) window.location.assign(r.data.checkout_url); else { toast.success('Plan changed'); qc.invalidateQueries(); } },
    onError: (e) => toast.error(e),
  });
  if (!q.data) return <Skeleton />;
  const d = q.data;
  return (
    <div className="stack">
      <div className="grid kpis">
        <Kpi label="Current plan" value={d.plan.name} sub={<Badge value={d.subscription?.status}>{d.subscription?.status}</Badge>} />
        <Kpi label="Seats" value={`${d.seats_used} / ${Math.min(d.subscription?.seats ?? Infinity, d.plan.limits?.seats ?? Infinity)}`} />
        <Kpi label="API calls (30d)" value={number(d.usage_30d.api_calls || 0)} />
        <Kpi label="Records created (30d)" value={number(d.usage_30d.records_created || 0)} />
      </div>
      {d.subscription?.trial_ends_at && d.subscription.status === 'trialing' && <Alert>Trial ends {date(d.subscription.trial_ends_at)}.</Alert>}
      {!d.billing_provider_configured && <Alert tone="warning">Online payments are not configured on this platform. Paid plan changes are applied by your platform administrator.</Alert>}
      <div className="grid cols-3">
        {d.available_plans.map((p) => (
          <Card key={p.id} title={p.name} actions={p.code === d.plan.code && <Badge tone="brand">Current</Badge>}>
            <div className="stack sm">
              <div className="kpi-value">{money(p.price_monthly, p.currency)}<span className="small muted"> / user / month</span></div>
              <div className="small muted">{p.description}</div>
              <DescriptionList items={[['Seats', p.limits.seats], ['Records', number(p.limits.records)], ['Storage', `${number(p.limits.storage_mb / 1000)} GB`], ['Workflows', p.limits.workflows], ['API access', p.features.includes('api') ? 'Yes' : 'No']]} />
              {can('billing:manage') && p.code !== d.plan.code && <Button onClick={() => change.mutate(p.code)} loading={change.isPending && change.variables === p.code}>Switch to {p.name}</Button>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

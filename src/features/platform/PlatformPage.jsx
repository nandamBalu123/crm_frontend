import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Alert, Badge, Button, Card, DescriptionList, Drawer, Input, Kpi, PageHeader, Select, Skeleton, Tabs, TextField } from '../../components/ui';
import { Pagination } from '../../components/data/DataTable';
import { dateTime, number, relative } from '../../utils/format';

function TenantDrawer({ id, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['platform-tenant', id], queryFn: () => get(`/platform/tenants/${id}`).then((r) => r.data) });
  const plans = useQuery({ queryKey: ['platform-plans'], queryFn: () => get('/platform/plans').then((r) => r.data) });
  const [reason, setReason] = useState('');
  const [plan, setPlan] = useState('');
  const [seats, setSeats] = useState('');
  const act = useMutation({
    mutationFn: ({ path, body }) => post(`/platform/tenants/${id}/${path}`, body),
    onSuccess: () => { toast.success('Done — recorded in the platform audit log'); qc.invalidateQueries({ queryKey: ['platform-tenants'] }); q.refetch(); },
    onError: (e) => toast.error(e),
  });
  const d = q.data;
  return (
    <Drawer open onClose={onClose} title={d?.tenant.name || 'Tenant'}>
      {!d ? <Skeleton /> : (
        <div className="stack">
          <Alert>Platform administrators manage tenants but cannot read tenant CRM data from this console.</Alert>
          <DescriptionList items={[['Slug', d.tenant.slug], ['Status', <Badge key="s" value={d.tenant.status} />], ['Plan', d.tenant.plan?.name], ['Subscription', d.subscription?.status], ['Seats', `${d.active_users} / ${d.subscription?.seats}`], ['Owner', d.owner?.email], ['Created', dateTime(d.tenant.created_at)], d.tenant.suspended_reason && ['Suspended because', d.tenant.suspended_reason]]} />
          <Card title="Usage (30 days)"><DescriptionList items={Object.entries(d.usage.reduce((a, u) => ({ ...a, [u.metric]: (a[u.metric] || 0) + Number(u.value) }), {})).map(([k, v]) => [k.replace(/_/g, ' '), number(v)])} /></Card>
          <Card title="Plan">
            <div className="row"><Select aria-label="Plan" value={plan || d.tenant.plan?.code || ''} onChange={(e) => setPlan(e.target.value)} options={(plans.data || []).map((p) => ({ value: p.code, label: p.name }))} /><Input aria-label="Seats" type="number" placeholder="Seats" value={seats} onChange={(e) => setSeats(e.target.value)} style={{ width: 100 }} />
              <Button onClick={() => act.mutate({ path: 'plan', body: { plan_code: plan || d.tenant.plan?.code, ...(seats ? { seats: Number(seats) } : {}) } })}>Apply</Button></div>
          </Card>
          {d.tenant.status === 'active' ? (
            <Card title="Suspend tenant"><div className="stack"><TextField label="Reason (visible in audit logs)" value={reason} onChange={(e) => setReason(e.target.value)} /><Button variant="danger" disabled={reason.length < 3} onClick={() => act.mutate({ path: 'suspend', body: { reason } })}>Suspend</Button></div></Card>
          ) : <Button variant="primary" onClick={() => act.mutate({ path: 'reactivate' })}>Reactivate tenant</Button>}
        </div>
      )}
    </Drawer>
  );
}

export function PlatformPage() {
  const [tab, setTab] = useState('tenants');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState(null);
  const tenants = useQuery({ queryKey: ['platform-tenants', q, page], queryFn: () => get('/platform/tenants', { q: q || undefined, page }) });
  const health = useQuery({ queryKey: ['platform-health'], queryFn: () => get('/platform/health').then((r) => r.data), enabled: tab === 'health', refetchInterval: 15_000 });
  const failed = useQuery({ queryKey: ['platform-failed'], queryFn: () => get('/platform/jobs/failed').then((r) => r.data), enabled: tab === 'health' });
  const audit = useQuery({ queryKey: ['platform-audit'], queryFn: () => get('/platform/audit').then((r) => r.data), enabled: tab === 'audit' });
  return (
    <>
      <PageHeader title="Platform administration" subtitle="Super-admin console — every action is audited." />
      <div className="stack">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'tenants', label: 'Tenants' }, { value: 'health', label: 'Health' }, { value: 'audit', label: 'Platform audit' }]} />
        {tab === 'tenants' && (
          <Card flush>
            <div className="toolbar"><Input aria-label="Search tenants" placeholder="Search tenants…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} style={{ width: 280 }} /></div>
            <table className="table"><thead><tr><th>Tenant</th><th>Plan</th><th>Status</th><th className="right">Active users</th><th>Created</th></tr></thead>
              <tbody>{(tenants.data?.data || []).map((t) => <tr key={t.id} className="clickable" onClick={() => setSel(t.id)}><td><strong>{t.name}</strong><div className="small subtle">{t.slug}</div></td><td>{t.plan?.name}</td><td><Badge value={t.status} /></td><td className="right">{t.active_users}</td><td className="small">{relative(t.created_at)}</td></tr>)}</tbody></table>
            <Pagination meta={tenants.data?.meta} onPage={setPage} />
          </Card>
        )}
        {tab === 'health' && health.data && (
          <>
            <div className="grid kpis">
              <Kpi label="Database" value={health.data.database} /><Kpi label="Pending jobs" value={health.data.jobs.pending || 0} sub={`oldest ${health.data.oldest_pending_job_age_s}s`} />
              <Kpi label="Dead jobs" value={health.data.jobs.dead || 0} /><Kpi label="Active tenants" value={health.data.tenants.active || 0} sub={`${health.data.tenants.suspended || 0} suspended`} />
              <Kpi label="Users" value={number(health.data.users)} /><Kpi label="API memory" value={`${health.data.process.rss_mb} MB`} sub={`up ${Math.round(health.data.process.uptime_s / 60)} min · ${health.data.process.node}`} />
            </div>
            <Card title="Dead jobs" flush><table className="table"><tbody>{(failed.data || []).map((j) => <tr key={j.id}><td className="mono">{j.type}</td><td className="small" style={{ whiteSpace: 'normal' }}>{j.last_error?.split('\n')[0]}</td><td className="small">{relative(j.updated_at)}</td></tr>)}</tbody></table></Card>
          </>
        )}
        {tab === 'audit' && <Card flush><table className="table"><tbody>{(audit.data || []).map((a) => <tr key={a.id}><td className="small nowrap">{dateTime(a.created_at)}</td><td className="mono">{a.action}</td><td>{a.summary}</td><td className="small subtle">{a.ip}</td></tr>)}</tbody></table></Card>}
      </div>
      {sel && <TenantDrawer id={sel} onClose={() => setSel(null)} />}
    </>
  );
}

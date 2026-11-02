import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Play, Save, Trash2 } from 'lucide-react';
import { get, post, del, download } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Alert, Button, Card, Checkbox, EmptyState, ErrorState, Kpi, PageHeader, Select, Skeleton, Tabs, TextField } from '../../components/ui';
import { money, percent, number } from '../../utils/format';

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'];
const GROUPS = {
  lead: ['status', 'source', 'rating', 'owner_id', 'industry', 'created_at:month', 'created_at:week'],
  opportunity: ['status', 'stage_id', 'owner_id', 'forecast_category', 'expected_close_date:month', 'closed_at:month', 'created_at:month'],
  activity: ['type', 'status', 'priority', 'owner_id', 'created_at:week', 'due_at:week'],
  ticket: ['status', 'priority', 'channel', 'owner_id', 'created_at:week'],
  account: ['type', 'industry', 'owner_id', 'country', 'created_at:month'],
  contact: ['lead_source', 'owner_id', 'country', 'created_at:month'],
  quote: ['status', 'owner_id', 'created_at:month'],
  campaign: ['status', 'type'],
};
const NUMERIC = { opportunity: ['amount', 'probability'], lead: ['score'], account: ['annual_revenue', 'employees'], quote: ['total'] };

function ReportChart({ result, chart }) {
  const data = (result.rows || []).map((r) => ({ name: r.label ?? (r.group === null ? '—' : String(r.group)), value: r.value }));
  if (!data.length) return <EmptyState title="No data for this report" />;
  return (
    <div style={{ height: 300 }}>
      <ResponsiveContainer>
        {chart === 'pie' ? (
          <PieChart><Pie data={data} dataKey="value" nameKey="name" outerRadius={110} label>{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart>
        ) : chart === 'line' ? (
          <LineChart data={data}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Line dataKey="value" stroke="var(--chart-1)" strokeWidth={2} /></LineChart>
        ) : (
          <BarChart data={data}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} /></BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function Builder({ initial, onSaved }) {
  const toast = useToast();
  const { can } = useAuth();
  const [spec, setSpec] = useState(initial || { name: '', entity_type: 'opportunity', group_by: 'status', metric: { fn: 'count' }, chart_type: 'bar', date_field: '', date_range: { preset: 'this_year' }, is_shared: false });
  const [result, setResult] = useState(null);
  const body = useMemo(() => ({
    entity_type: spec.entity_type, report_type: 'summary', group_by: spec.group_by || null, metric: spec.metric.fn === 'count' ? { fn: 'count' } : spec.metric,
    ...(spec.date_field ? { date_field: spec.date_field, date_range: spec.date_range } : {}),
  }), [spec]);
  const run = useMutation({ mutationFn: () => post('/reports/run', body), onSuccess: (r) => setResult(r.data), onError: (e) => toast.error(e) });
  const save = useMutation({ mutationFn: () => post('/reports', { ...body, name: spec.name, chart_type: spec.chart_type, is_shared: spec.is_shared }), onSuccess: () => { toast.success('Report saved'); onSaved?.(); }, onError: (e) => toast.error(e) });
  const numeric = NUMERIC[spec.entity_type] || [];
  return (
    <div className="split">
      <Card title="Result" actions={<Button icon={Play} variant="primary" loading={run.isPending} onClick={() => run.mutate()}>Run</Button>}>
        {result ? <ReportChart result={result} chart={spec.chart_type} /> : <EmptyState title="Configure and run a report" message="Group any CRM object by a field or time bucket and aggregate a metric." />}
        {result && <table className="table" style={{ marginTop: 12 }}><tbody>{result.rows.map((r, i) => <tr key={i}><td>{r.label ?? String(r.group ?? '—')}</td><td className="right">{number(r.value)}</td></tr>)}</tbody></table>}
      </Card>
      <Card title="Report definition">
        <div className="stack">
          <TextField as="select" label="Object" value={spec.entity_type} onChange={(e) => setSpec({ ...spec, entity_type: e.target.value, group_by: GROUPS[e.target.value][0], metric: { fn: 'count' } })} options={Object.keys(GROUPS).map((k) => ({ value: k, label: k }))} />
          <TextField as="select" label="Group by" value={spec.group_by} onChange={(e) => setSpec({ ...spec, group_by: e.target.value })} options={GROUPS[spec.entity_type].map((g) => ({ value: g, label: g.replace(':', ' by ').replace(/_/g, ' ') }))} />
          <div className="grid cols-2">
            <TextField as="select" label="Metric" value={spec.metric.fn} onChange={(e) => setSpec({ ...spec, metric: { fn: e.target.value, field: numeric[0] } })} options={[{ value: 'count', label: 'Count' }, ...(numeric.length ? ['sum', 'avg', 'max', 'min'].map((f) => ({ value: f, label: f.toUpperCase() })) : [])]} />
            {spec.metric.fn !== 'count' && <TextField as="select" label="Of field" value={spec.metric.field} onChange={(e) => setSpec({ ...spec, metric: { ...spec.metric, field: e.target.value } })} options={numeric} />}
          </div>
          <div className="grid cols-2">
            <TextField as="select" label="Date field" value={spec.date_field} placeholder="No date filter" onChange={(e) => setSpec({ ...spec, date_field: e.target.value })} options={['created_at', 'updated_at', ...(spec.entity_type === 'opportunity' ? ['expected_close_date', 'closed_at'] : [])]} />
            {spec.date_field && <TextField as="select" label="Range" value={spec.date_range.preset} onChange={(e) => setSpec({ ...spec, date_range: { preset: e.target.value } })} options={['this_month', 'last_month', 'last_30_days', 'this_quarter', 'this_year']} />}
          </div>
          <TextField as="select" label="Chart" value={spec.chart_type} onChange={(e) => setSpec({ ...spec, chart_type: e.target.value })} options={['bar', 'line', 'pie']} />
          {can('reports:create') && <>
            <hr />
            <TextField label="Save as" value={spec.name} onChange={(e) => setSpec({ ...spec, name: e.target.value })} placeholder="Report name" />
            <Checkbox label="Share with workspace" checked={spec.is_shared} onChange={(e) => setSpec({ ...spec, is_shared: e.target.checked })} />
            <Button icon={Save} disabled={!spec.name} loading={save.isPending} onClick={() => save.mutate()}>Save report</Button>
          </>}
        </div>
      </Card>
    </div>
  );
}

function Saved() {
  const qc = useQueryClient();
  const toast = useToast();
  const { me } = useAuth();
  const list = useQuery({ queryKey: ['reports'], queryFn: () => get('/reports').then((r) => r.data) });
  const [selected, setSelected] = useState(null);
  const run = useQuery({ queryKey: ['report-run', selected?.id], queryFn: () => get(`/reports/${selected.id}/run`).then((r) => r.data.result), enabled: !!selected });
  const remove = useMutation({ mutationFn: (id) => del(`/reports/${id}`), onSuccess: () => { setSelected(null); qc.invalidateQueries({ queryKey: ['reports'] }); } });
  return (
    <div className="split">
      <Card title={selected?.name || 'Select a report'} actions={selected && <>
        <Button size="sm" icon={Download} onClick={() => download(`/reports/${selected.id}/export`, undefined, 'report.csv').catch((e) => toast.error(e))}>CSV</Button>
        {selected.owner_id === me.user.id && <Button size="sm" variant="ghost" icon={Trash2} aria-label="Delete report" onClick={() => remove.mutate(selected.id)} />}
      </>}>
        {!selected ? <EmptyState title="Choose a saved report" /> : run.isLoading ? <Skeleton /> : run.isError ? <ErrorState error={run.error} /> : <ReportChart result={run.data} chart={selected.chart_type} />}
      </Card>
      <Card title="Saved reports" flush>
        {!list.data?.length ? <div className="card-body small subtle">No saved reports yet.</div> : (
          <table className="table"><tbody>{list.data.map((r) => <tr key={r.id} className="clickable" onClick={() => setSelected(r)}><td><strong>{r.name}</strong><div className="small subtle">{r.entity_type} · {r.group_by}{r.is_shared ? ' · shared' : ''}</div></td></tr>)}</tbody></table>
        )}
      </Card>
    </div>
  );
}

function Analytics() {
  const [preset, setPreset] = useState('this_quarter');
  const conv = useQuery({ queryKey: ['an-conv', preset], queryFn: () => get('/reports/analytics/conversion', { preset }).then((r) => r.data) });
  const fc = useQuery({ queryKey: ['an-forecast'], queryFn: () => get('/reports/analytics/forecast', { preset: 'this_year' }).then((r) => r.data) });
  const perf = useQuery({ queryKey: ['an-perf', preset], queryFn: () => get('/reports/analytics/sales-performance', { preset }).then((r) => r.data) });
  const act = useQuery({ queryKey: ['an-act', preset], queryFn: () => get('/reports/analytics/activities', { preset }).then((r) => r.data) });
  const c = conv.data || {};
  return (
    <div className="stack lg">
      <div className="row end"><Select aria-label="Period" value={preset} onChange={(e) => setPreset(e.target.value)} options={['this_month', 'last_30_days', 'this_quarter', 'this_year'].map((p) => ({ value: p, label: p.replace(/_/g, ' ') }))} /></div>
      {conv.isError && <Alert tone="danger">{conv.error.message}</Alert>}
      <div className="grid kpis">
        {'leads_created' in c && <Kpi label="Leads created" value={number(c.leads_created)} sub={`${percent(c.lead_conversion_rate, 1)} converted`} />}
        {'win_rate' in c && <Kpi label="Win rate" value={percent(c.win_rate)} sub={`${c.deals_won} won / ${c.deals_lost} lost`} />}
        {'won_revenue' in c && <Kpi label="Won revenue" value={money(c.won_revenue, undefined, { compact: true })} sub={`Avg ${money(c.average_deal_size, undefined, { compact: true })}`} />}
        {act.data && <Kpi label="Overdue activities" value={act.data.overdue} />}
      </div>
      <div className="grid cols-2">
        <Card title="Forecast by month (this year)" flush>
          <table className="table"><thead><tr><th>Month</th><th className="right">Won</th><th className="right">Commit</th><th className="right">Best case</th><th className="right">Pipeline</th><th className="right">Weighted</th></tr></thead>
            <tbody>{(fc.data?.months || []).map((m) => <tr key={m.month}><td>{m.month}</td>{['closed_won', 'commit', 'best_case', 'pipeline', 'weighted'].map((k) => <td key={k} className="right">{money(m[k], undefined, { compact: true })}</td>)}</tr>)}</tbody></table>
        </Card>
        <Card title="Sales performance" flush>
          <table className="table"><thead><tr><th>Owner</th><th className="right">Won</th><th className="right">Lost</th><th className="right">Win rate</th><th className="right">Revenue</th></tr></thead>
            <tbody>{(perf.data?.rows || []).map((r) => <tr key={r.owner_id || 'x'}><td>{r.name}</td><td className="right">{r.won}</td><td className="right">{r.lost}</td><td className="right">{percent(r.win_rate)}</td><td className="right">{money(r.won_amount, undefined, { compact: true })}</td></tr>)}</tbody></table>
        </Card>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const [tab, setTab] = useState('analytics');
  const qc = useQueryClient();
  return (
    <>
      <PageHeader title="Reports & analytics" subtitle="All figures respect your permissions and record visibility." />
      <div className="stack">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'analytics', label: 'Analytics' }, { value: 'builder', label: 'Report builder' }, { value: 'saved', label: 'Saved reports' }]} />
        {tab === 'analytics' && <Analytics />}
        {tab === 'builder' && <Builder onSaved={() => { qc.invalidateQueries({ queryKey: ['reports'] }); setTab('saved'); }} />}
        {tab === 'saved' && <Saved />}
      </div>
    </>
  );
}

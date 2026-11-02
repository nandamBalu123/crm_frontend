import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { get } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useMembers } from '../../hooks/useCustomFields';
import { Card, ErrorState, Kpi, PageHeader, Select, Skeleton, EmptyState, Badge } from '../../components/ui';
import { money, number, percent, dateTime, relative, fullName } from '../../utils/format';

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'];
const axis = { tick: { fill: 'var(--text-muted)', fontSize: 12 }, axisLine: false, tickLine: false };
const tooltip = { contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

export function DashboardPage() {
  const { me } = useAuth();
  const members = useMembers();
  const [preset, setPreset] = useState('this_month');
  const [owner, setOwner] = useState('');
  const q = useQuery({ queryKey: ['dashboard', preset, owner], queryFn: () => get('/reports/dashboard', { preset, owner_id: owner || undefined }).then((r) => r.data) });
  const d = q.data;
  const k = d?.kpis || {};
  return (
    <>
      <PageHeader title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${me.user.first_name}`} subtitle="Here is what is happening in your pipeline."
        actions={<>
          <Select aria-label="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="All owners" options={[{ value: 'me', label: 'My records' }, ...(members.data || []).map((m) => ({ value: m.user_id, label: fullName(m.user) }))]} />
          <Select aria-label="Date range" value={preset} onChange={(e) => setPreset(e.target.value)} options={[{ value: 'this_month', label: 'This month' }, { value: 'last_30_days', label: 'Last 30 days' }, { value: 'this_quarter', label: 'This quarter' }, { value: 'this_year', label: 'This year' }]} />
        </>} />
      {q.isError ? <ErrorState error={q.error} onRetry={q.refetch} /> : !d ? <Skeleton rows={8} height={24} /> : (
        <div className="stack lg">
          <div className="grid kpis">
            {'pipeline_value' in k && <Kpi label="Open pipeline" value={money(k.pipeline_value, undefined, { compact: true })} sub={`Weighted ${money(k.weighted_pipeline, undefined, { compact: true })}`} />}
            {'won_revenue' in k && <Kpi label="Won revenue" value={money(k.won_revenue, undefined, { compact: true })} sub={`${k.deals_won} deals · avg ${money(k.average_deal_size, undefined, { compact: true })}`} />}
            {'win_rate' in k && <Kpi label="Win rate" value={percent(k.win_rate)} sub="Closed in period" />}
            {'new_leads' in k && <Kpi label="New leads" value={number(k.new_leads)} sub={`${number(k.open_leads)} open · ${percent(k.lead_conversion_rate || 0, 1)} converted`} />}
            {'overdue_activities' in k && <Kpi label="Overdue activities" value={number(k.overdue_activities)} sub={<Link to="/activities?filter[status]=open&sort=due_at">Review</Link>} />}
            {'stalled_deals' in k && <Kpi label="Stalled deals" value={number(k.stalled_deals)} sub="No stage change recently" />}
            {'open_tickets' in k && <Kpi label="Open tickets" value={number(k.open_tickets)} sub={`${number(k.sla_breached_tickets)} past SLA`} />}
          </div>

          {d.widgets.includes('pipeline') && (
            <div className="grid cols-2">
              <Card title={`Pipeline by stage · ${d.pipeline.pipeline?.name || ''}`}>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer>
                    <BarChart data={d.pipeline.stages.map((s) => ({ name: s.name, amount: Number(s.amount), weighted: Number(s.weighted) }))}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="name" {...axis} />
                      <YAxis {...axis} tickFormatter={(v) => money(v, undefined, { compact: true })} width={70} />
                      <Tooltip {...tooltip} formatter={(v) => money(v)} />
                      <Legend />
                      <Bar dataKey="amount" name="Amount" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="weighted" name="Weighted" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card title="Revenue & forecast (this year)">
                <div style={{ height: 260 }}>
                  {!d.revenue_by_month.length ? <EmptyState title="No closed or forecast revenue yet" /> : (
                    <ResponsiveContainer>
                      <LineChart data={d.revenue_by_month.map((m) => ({ ...m, closed_won: Number(m.closed_won), weighted: Number(m.weighted), commit: Number(m.commit) }))}>
                        <CartesianGrid vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="month" {...axis} />
                        <YAxis {...axis} tickFormatter={(v) => money(v, undefined, { compact: true })} width={70} />
                        <Tooltip {...tooltip} formatter={(v) => money(v)} />
                        <Legend />
                        <Line dataKey="closed_won" name="Won" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
                        <Line dataKey="commit" name="Commit" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                        <Line dataKey="weighted" name="Weighted pipeline" stroke="var(--chart-4)" strokeDasharray="4 4" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>
            </div>
          )}

          <div className="grid cols-3">
            {d.funnel && (
              <Card title="Lead funnel">
                <div className="stack sm">
                  {d.funnel.stages.map((s) => {
                    const pct = d.funnel.total ? s.count / d.funnel.total : 0;
                    return (
                      <div key={s.stage}>
                        <div className="row between small"><span>{s.stage.replace(/_/g, ' ')}</span><strong>{s.count}</strong></div>
                        <div className="progress" aria-hidden><span style={{ width: `${Math.max(pct * 100, 2)}%` }} /></div>
                      </div>
                    );
                  })}
                  <div className="small muted">Conversion rate {percent(d.funnel.conversion_rate, 1)} · {d.funnel.unqualified} unqualified</div>
                </div>
              </Card>
            )}
            {d.leads_by_source && (
              <Card title="Leads by source">
                <div style={{ height: 220 }}>
                  {!d.leads_by_source.length ? <EmptyState title="No leads in period" /> : (
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={d.leads_by_source} dataKey="count" nameKey="source" innerRadius={50} outerRadius={80} paddingAngle={2}>
                          {d.leads_by_source.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip {...tooltip} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>
            )}
            {d.leaderboard && (
              <Card title="Top performers" flush>
                {!d.leaderboard.length ? <div className="card-body small subtle">No closed deals in this period.</div> : (
                  <table className="table"><tbody>
                    {d.leaderboard.map((r, i) => <tr key={r.owner_id || i}><td>{i + 1}. {r.name}</td><td className="right">{money(r.won_amount, undefined, { compact: true })}</td><td className="right subtle">{percent(r.win_rate)}</td></tr>)}
                  </tbody></table>
                )}
              </Card>
            )}
          </div>

          <div className="grid cols-3">
            {d.upcoming_activities && (
              <Card title="Upcoming" actions={<Link to="/activities" className="small">All activities</Link>}>
                {!d.upcoming_activities.length ? <span className="small subtle">Nothing scheduled.</span> : (
                  <ul className="stack sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {d.upcoming_activities.map((a) => <li key={a.id} className="row between"><span className="truncate grow">{a.subject}</span><span className="small subtle nowrap">{dateTime(a.due_at || a.start_at)}</span></li>)}
                  </ul>
                )}
              </Card>
            )}
            {d.overdue_activities && (
              <Card title="Overdue">
                {!d.overdue_activities.length ? <span className="small subtle">You're on top of things.</span> : (
                  <ul className="stack sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {d.overdue_activities.map((a) => <li key={a.id} className="row between"><span className="truncate grow">{a.subject}</span><Badge tone="danger">{relative(a.due_at)}</Badge></li>)}
                  </ul>
                )}
              </Card>
            )}
            <Card title="Recent activity">
              {!d.recent_activity.length ? <span className="small subtle">No recent activity.</span> : (
                <ul className="stack sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {d.recent_activity.map((e) => <li key={e.id} className="small"><strong>{e.actor ? `${e.actor.first_name} ${e.actor.last_name}` : 'System'}</strong> · {e.summary} <span className="subtle">({e.entity_type}) {relative(e.created_at)}</span></li>)}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

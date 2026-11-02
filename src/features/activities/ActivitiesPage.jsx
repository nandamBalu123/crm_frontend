import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { get, post } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, Tabs } from '../../components/ui';
import { EntityListPage } from '../entities/EntityListPage';
import { dateTime } from '../../utils/format';

function startOfWeek(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

function Agenda() {
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useAuth();
  const end = useMemo(() => new Date(anchor.getTime() + 7 * 86400_000), [anchor]);
  const q = useQuery({ queryKey: ['activities', 'calendar', anchor.toISOString()], queryFn: () => get('/activities/calendar', { from: anchor.toISOString(), to: end.toISOString() }).then((r) => r.data) });
  const complete = useMutation({ mutationFn: (id) => post(`/activities/${id}/complete`, {}), onSuccess: () => { toast.success('Completed'); qc.invalidateQueries({ queryKey: ['activities'] }); }, onError: (e) => toast.error(e) });
  const days = Array.from({ length: 7 }, (_, i) => new Date(anchor.getTime() + i * 86400_000));
  const byDay = (d) => (q.data || []).filter((a) => new Date(a.start_at || a.due_at).toDateString() === d.toDateString());
  return (
    <Card title={`Week of ${anchor.toLocaleDateString()}`} actions={<>
      <Button size="sm" icon={ChevronLeft} aria-label="Previous week" onClick={() => setAnchor(new Date(anchor.getTime() - 7 * 86400_000))} />
      <Button size="sm" onClick={() => setAnchor(startOfWeek(new Date()))}>Today</Button>
      <Button size="sm" icon={ChevronRight} aria-label="Next week" onClick={() => setAnchor(end)} />
    </>}>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {days.map((d) => (
          <div key={d.toISOString()} className="stack sm" style={{ minHeight: 120, borderTop: `3px solid ${d.toDateString() === new Date().toDateString() ? 'var(--brand)' : 'var(--border)'}`, paddingTop: 6 }}>
            <strong className="small">{d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
            {byDay(d).map((a) => (
              <div key={a.id} className="deal-card" style={{ cursor: 'default' }}>
                <div className="row between"><Badge>{a.type}</Badge>{a.status === 'open' && can('activities:update') && <Button size="sm" variant="ghost" icon={Check} aria-label={`Complete ${a.subject}`} onClick={() => complete.mutate(a.id)} />}</div>
                <div className="small" style={{ textDecoration: a.status === 'completed' ? 'line-through' : undefined }}>{a.subject}</div>
                <div className="small subtle">{dateTime(a.start_at || a.due_at)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ActivitiesPage() {
  const [view, setView] = useState('list');
  return (
    <div className="stack">
      <Tabs value={view} onChange={setView} tabs={[{ value: 'list', label: 'List' }, { value: 'agenda', label: 'Week agenda' }]} />
      {view === 'list' ? <EntityListPage entityType="activity" rowLink={false} /> : <Agenda />}
      <p className="small subtle">Calendar sync with Google/Microsoft requires connecting an account in Settings → Integrations (two-way sync is on the roadmap).</p>
    </div>
  );
}

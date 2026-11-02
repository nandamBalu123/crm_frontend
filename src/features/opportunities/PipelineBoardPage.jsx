import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { get } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { Badge, Button, ErrorState, Input, PageHeader, Select, Skeleton } from '../../components/ui';
import { CreateDrawer } from '../entities/EntityListPage';
import { useStageMove } from './useStageMove';
import { LossReasonModal } from './LossReasonModal';
import { money, date, relative } from '../../utils/format';

export function PipelineBoardPage() {
  const { can } = useAuth();
  const [pipelineId, setPipelineId] = useState('');
  const [owner, setOwner] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 300);
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);
  const [creating, setCreating] = useState(false);
  const pipelines = useQuery({ queryKey: ['pipelines'], queryFn: () => get('/pipelines').then((r) => r.data) });
  const board = useQuery({ queryKey: ['board', pipelineId, owner, dq], queryFn: () => get('/opportunities/board', { pipeline_id: pipelineId || undefined, owner_id: owner || undefined, q: dq || undefined }).then((r) => r.data) });
  const { request, pendingLoss, cancelLoss, confirmLoss } = useStageMove();
  const stages = board.data?.columns.map((c) => c.stage) || [];
  const findOpp = (id) => board.data?.columns.flatMap((c) => c.opportunities).find((o) => o.id === id);
  return (
    <>
      <PageHeader title="Pipeline" subtitle={board.data?.pipeline?.name}
        actions={<>
          <Select aria-label="Pipeline" value={pipelineId} onChange={(e) => setPipelineId(e.target.value)} options={(pipelines.data || []).map((p) => ({ value: p.id, label: p.name + (p.is_default ? ' (default)' : '') }))} placeholder="Default pipeline" />
          <Select aria-label="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} options={[{ value: 'me', label: 'My deals' }]} placeholder="All deals" />
          <Input aria-label="Filter deals" placeholder="Filter deals…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 180 }} />
          <Link to="/opportunities" className="btn">Table view</Link>
          {can('opportunities:create') && <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>New deal</Button>}
        </>} />
      {board.isError ? <ErrorState error={board.error} onRetry={board.refetch} /> : board.isLoading ? <Skeleton rows={6} height={40} /> : (
        <div className="board" aria-label="Pipeline board">
          {board.data.columns.map((col) => (
            <section key={col.stage.id} className={`board-col ${overStage === col.stage.id ? 'drop' : ''}`} aria-label={`${col.stage.name}: ${col.count} deals`}
              onDragOver={(e) => { e.preventDefault(); setOverStage(col.stage.id); }} onDragLeave={() => setOverStage(null)}
              onDrop={(e) => { e.preventDefault(); setOverStage(null); const opp = findOpp(e.dataTransfer.getData('text/plain')); if (opp) request(opp, col.stage); }}>
              <div className="board-col-header">
                <div className="row between"><strong>{col.stage.name}</strong><Badge tone={col.stage.category === 'won' ? 'success' : col.stage.category === 'lost' ? 'danger' : undefined}>{col.count}</Badge></div>
                <div className="small muted">{money(col.total_amount, undefined, { compact: true })} · {col.stage.probability}%</div>
              </div>
              <div className="board-col-body">
                {col.opportunities.map((o) => (
                  <article key={o.id} className={`deal-card ${dragId === o.id ? 'dragging' : ''}`} draggable={can('opportunities:update')}
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', o.id); setDragId(o.id); }} onDragEnd={() => setDragId(null)}>
                    <Link to={`/opportunities/${o.id}`}><strong>{o.name}</strong></Link>
                    <div className="small muted">{o.account?.name || 'No account'}</div>
                    <div className="row between small" style={{ marginTop: 6 }}>
                      <strong>{o.amount !== undefined ? money(o.amount, o.currency) : '—'}</strong>
                      <span className={o.expected_close_date && o.expected_close_date < new Date().toISOString().slice(0, 10) && o.status === 'open' ? 'badge danger' : 'subtle'}>{date(o.expected_close_date)}</span>
                    </div>
                    <div className="row between small subtle" style={{ marginTop: 4 }}>
                      <span>{o.owner?.name}</span><span title="Time in stage">{relative(o.stage_entered_at)}</span>
                    </div>
                    {can('opportunities:update') && (
                      <select className="scope-select" style={{ marginTop: 6, width: '100%' }} aria-label={`Move ${o.name} to stage`} value={col.stage.id}
                        onChange={(e) => request(o, stages.find((s) => s.id === e.target.value))}>
                        {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    )}
                  </article>
                ))}
                {col.count > col.opportunities.length && <div className="small subtle center">+{col.count - col.opportunities.length} more — use table view</div>}
              </div>
            </section>
          ))}
        </div>
      )}
      <LossReasonModal open={!!pendingLoss} onClose={cancelLoss} onConfirm={confirmLoss} />
      <CreateDrawer entityType="opportunity" open={creating} onClose={() => setCreating(false)} onCreated={() => board.refetch()} />
    </>
  );
}

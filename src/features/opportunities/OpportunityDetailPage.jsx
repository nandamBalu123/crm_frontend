import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { get, post, put } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Badge, Button, Card, DescriptionList, Select, Input } from '../../components/ui';
import { RecordPage } from '../entities/RecordPage';
import { useStageMove } from './useStageMove';
import { LossReasonModal } from './LossReasonModal';
import { money, date, dateTime, fullName } from '../../utils/format';

function StagePath({ opp }) {
  const { can } = useAuth();
  const pipeline = useQuery({ queryKey: ['pipelines', opp.pipeline_id], queryFn: () => get(`/pipelines/${opp.pipeline_id}`).then((r) => r.data) });
  const { request, pendingLoss, cancelLoss, confirmLoss } = useStageMove();
  const stages = pipeline.data?.stages || [];
  const currentIndex = stages.findIndex((s) => s.id === opp.stage_id);
  return (
    <Card>
      <div className="row tight" role="list" aria-label="Stages" style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
        {stages.map((s, i) => (
          <button key={s.id} role="listitem" type="button" disabled={!can('opportunities:update')} onClick={() => request(opp, s)} aria-current={s.id === opp.stage_id ? 'step' : undefined}
            className={`btn sm ${s.id === opp.stage_id ? (s.category === 'lost' ? 'danger' : 'primary') : ''}`}
            style={{ flex: 1, minWidth: 110, background: i < currentIndex && s.category === 'open' ? 'var(--brand-soft)' : undefined }}>{s.name}</button>
        ))}
      </div>
      <LossReasonModal open={!!pendingLoss} onClose={cancelLoss} onConfirm={confirmLoss} />
    </Card>
  );
}

function ProductsEditor({ opp }) {
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const lines = useQuery({ queryKey: ['opp-products', opp.id], queryFn: () => get(`/opportunities/${opp.id}/products`).then((r) => r.data) });
  const products = useQuery({ queryKey: ['products', 'active'], queryFn: () => get('/products', { 'filter[is_active]': 'true', page_size: 100 }).then((r) => r.data) });
  const [items, setItems] = useState(null);
  useEffect(() => { if (lines.data) setItems(lines.data.map((l) => ({ product_id: l.product_id, quantity: Number(l.quantity).toString(), unit_price: Number(l.unit_price).toString(), discount_percent: Number(l.discount_percent).toString() }))); }, [lines.data]);
  const save = useMutation({
    mutationFn: () => put(`/opportunities/${opp.id}/products`, { items: items.filter((i) => i.product_id), update_amount: true }),
    onSuccess: () => { toast.success('Products saved; amount recalculated'); qc.invalidateQueries({ queryKey: ['opp-products', opp.id] }); qc.invalidateQueries({ queryKey: ['opportunities', opp.id] }); },
    onError: (e) => toast.error(e),
  });
  if (!items) return null;
  const editable = can('opportunities:update');
  const set = (i, k, v) => setItems(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const preview = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0) * (1 - Number(it.discount_percent || 0) / 100), 0);
  return (
    <div className="stack">
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Disc. %</th><th className="right">Line total</th><th /></tr></thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td><Select aria-label="Product" value={it.product_id} disabled={!editable} placeholder="Choose product" options={(products.data || []).map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
                onChange={(e) => { const p = products.data.find((x) => x.id === e.target.value); setItems(items.map((x, j) => (j === i ? { ...x, product_id: e.target.value, unit_price: p ? Number(p.unit_price).toString() : x.unit_price } : x))); }} /></td>
              <td><Input aria-label="Quantity" type="number" min="0" step="any" value={it.quantity} disabled={!editable} onChange={(e) => set(i, 'quantity', e.target.value)} style={{ width: 80 }} /></td>
              <td><Input aria-label="Unit price" type="number" min="0" step="any" value={it.unit_price} disabled={!editable} onChange={(e) => set(i, 'unit_price', e.target.value)} style={{ width: 110 }} /></td>
              <td><Input aria-label="Discount percent" type="number" min="0" max="100" step="any" value={it.discount_percent} disabled={!editable} onChange={(e) => set(i, 'discount_percent', e.target.value)} style={{ width: 80 }} /></td>
              <td className="right">{money(Number(it.quantity || 0) * Number(it.unit_price || 0) * (1 - Number(it.discount_percent || 0) / 100), opp.currency)}</td>
              <td>{editable && <Button size="sm" variant="ghost" icon={Trash2} aria-label="Remove line" onClick={() => setItems(items.filter((_, j) => j !== i))} />}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {editable && <div className="row between">
        <Button size="sm" icon={Plus} onClick={() => setItems([...items, { product_id: '', quantity: '1', unit_price: '0', discount_percent: '0' }])}>Add product</Button>
        <div className="row"><span className="small muted">Preview {money(preview, opp.currency)} — final totals are calculated by the server</span><Button variant="primary" size="sm" loading={save.isPending} onClick={() => save.mutate()}>Save products</Button></div>
      </div>}
    </div>
  );
}

function StageHistory({ id }) {
  const q = useQuery({ queryKey: ['stage-history', id], queryFn: () => get(`/opportunities/${id}/stage-history`).then((r) => r.data) });
  return (
    <ol className="timeline">
      {(q.data || []).map((h) => (
        <li key={h.id}><span className="tl-icon" /><div><strong>{h.fromStage ? `${h.fromStage.name} → ` : ''}{h.toStage?.name}</strong><div className="small subtle">{dateTime(h.created_at)} · {h.probability}% · {money(h.amount)}{h.time_in_previous_stage_seconds ? ` · ${Math.round(h.time_in_previous_stage_seconds / 86400)}d in previous stage` : ''}</div></div></li>
      ))}
    </ol>
  );
}

export function OpportunityDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const createQuote = useMutation({
    mutationFn: (opp) => post('/quotes', { title: `Proposal: ${opp.name}`, opportunity_id: opp.id, line_items: [] }),
    onSuccess: (res) => navigate(`/quotes/${res.data.id}`),
    onError: (e) => toast.error(e),
  });
  return (
    <RecordPage entityType="opportunity" id={id}
      headerExtra={(r) => <Badge value={r.status} />}
      composerLinks={(r) => ({ opportunity_id: r.id })}
      actions={(r) => can('quotes:create') && <Button icon={FileText} loading={createQuote.isPending} onClick={() => createQuote.mutate(r)}>Create quote</Button>}
      tabs={[
        { value: 'products', label: 'Products', render: (r) => <ProductsEditor opp={r} /> },
        { value: 'history', label: 'Stage history', render: (r) => <StageHistory id={r.id} /> },
      ]}
      details={(r) => (
        <>
          <StagePath opp={r} />
          <Card title="Deal details">
            <DescriptionList items={[
              ['Amount', r.amount !== undefined ? <strong key="a">{money(r.amount, r.currency)}</strong> : <span className="subtle">Restricted</span>],
              ['Weighted', r.weighted_amount && money(r.weighted_amount, r.currency)], ['Probability', r.probability !== undefined ? `${r.probability}%` : null],
              ['Expected close', date(r.expected_close_date)], ['Forecast', r.forecast_category?.replace('_', ' ')], ['Stage', r.stage?.name],
              ['Account', r.account && <Link to={`/accounts/${r.account.id}`}>{r.account.name}</Link>], ['Contact', r.contact && <Link to={`/contacts/${r.contact.id}`}>{fullName(r.contact)}</Link>],
              ['Next step', r.next_step], ['Owner', r.owner?.name], r.status === 'lost' && ['Loss reason', r.loss_reason], r.closed_at && ['Closed', dateTime(r.closed_at)],
            ]} />
          </Card>
        </>
      )} />
  );
}

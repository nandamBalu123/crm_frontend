import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Download, Plus, Save, Send, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { get, post, patch, download } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Alert, Badge, Button, Card, DescriptionList, ErrorState, Input, Modal, PageHeader, Select, Skeleton, TextField } from '../../components/ui';
import { money, date, dateTime } from '../../utils/format';

const EDITABLE = ['draft', 'rejected'];

export function QuoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['quotes', id], queryFn: () => get(`/quotes/${id}`).then((r) => r.data) });
  const products = useQuery({ queryKey: ['products', 'active'], queryFn: () => get('/products', { 'filter[is_active]': 'true', page_size: 100 }).then((r) => r.data) });
  const revisions = useQuery({ queryKey: ['quotes', id, 'revisions'], queryFn: () => get(`/quotes/${id}/revisions`).then((r) => r.data) });
  const [lines, setLines] = useState([]);
  const [meta, setMeta] = useState({});
  const [reject, setReject] = useState(false);
  const [comment, setComment] = useState('');
  useEffect(() => {
    if (!q.data) return;
    setLines((q.data.lineItems || []).map((l) => ({ product_id: l.product_id || '', name: l.name, quantity: Number(l.quantity).toString(), unit_price: Number(l.unit_price).toString(), discount_percent: Number(l.discount_percent).toString(), tax_rate: Number(l.tax_rate).toString() })));
    setMeta({ title: q.data.title, valid_until: q.data.valid_until || '', terms: q.data.terms || '', notes: q.data.notes || '' });
  }, [q.data]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['quotes'] }); };
  const save = useMutation({
    mutationFn: () => patch(`/quotes/${id}`, { ...meta, valid_until: meta.valid_until || null, version: q.data.version, line_items: lines.map((l) => ({ ...(l.product_id ? { product_id: l.product_id } : {}), name: l.name || undefined, quantity: l.quantity || '1', unit_price: l.unit_price || '0', discount_percent: l.discount_percent === '' ? null : l.discount_percent, tax_rate: l.tax_rate || '0' })) }),
    onSuccess: () => { toast.success('Quote saved — totals recalculated'); refresh(); }, onError: (e) => toast.error(e),
  });
  const action = useMutation({
    mutationFn: ({ name, body }) => post(`/quotes/${id}/${name}`, body || {}),
    onSuccess: (res, vars) => { toast.success(`Quote ${vars.name === 'revise' ? 'revised' : 'updated'}`); refresh(); if (vars.name === 'revise') navigate(`/quotes/${res.data.id}`); },
    onError: (e) => toast.error(e),
  });
  if (q.isLoading) return <Skeleton rows={8} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const quote = q.data;
  const editable = EDITABLE.includes(quote.status) && can('quotes:update');
  const set = (i, k, v) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  return (
    <>
      <PageHeader breadcrumbs={[{ label: 'Quotes', to: '/quotes' }, { label: `Q-${quote.number}` }]}
        title={<span className="row">Q-{quote.number}{quote.revision > 1 && ` · rev ${quote.revision}`} <Badge value={quote.status} /></span>}
        subtitle={quote.account?.name}
        actions={<>
          <Button icon={Download} onClick={() => download(`/quotes/${id}/pdf`, undefined, `Q-${quote.number}.pdf`).catch((e) => toast.error(e))}>PDF</Button>
          {editable && <Button icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save</Button>}
          {editable && <Button variant="primary" icon={Send} onClick={() => action.mutate({ name: 'submit' })}>Submit</Button>}
          {quote.status === 'pending_approval' && can('quotes:approve') && <>
            <Button variant="primary" icon={CheckCircle2} onClick={() => action.mutate({ name: 'approve' })}>Approve</Button>
            <Button variant="danger" icon={XCircle} onClick={() => setReject(true)}>Reject</Button>
          </>}
          {quote.status === 'approved' && can('quotes:update') && <Button variant="primary" icon={Send} onClick={() => action.mutate({ name: 'send' })}>Mark sent</Button>}
          {quote.status === 'sent' && can('quotes:update') && <>
            <Button variant="primary" onClick={() => action.mutate({ name: 'accept' })}>Accepted</Button>
            <Button onClick={() => action.mutate({ name: 'decline' })}>Declined</Button>
          </>}
          {!['accepted', 'draft'].includes(quote.status) && can('quotes:create') && <Button icon={Copy} onClick={() => action.mutate({ name: 'revise' })}>New revision</Button>}
        </>} />
      {quote.status === 'pending_approval' && <div style={{ marginBottom: 12 }}><Alert tone="warning">This quote has a discount above the approval policy and is awaiting approval.</Alert></div>}
      {quote.status === 'rejected' && <div style={{ marginBottom: 12 }}><Alert tone="danger">Rejected: {quote.rejection_reason}. Edit and resubmit.</Alert></div>}
      <div className="split">
        <Card title="Line items" flush>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Disc. %</th><th>Tax %</th><th className="right">Total</th><th /></tr></thead>
            <tbody>
              {(editable ? lines : quote.lineItems).map((l, i) => editable ? (
                <tr key={i}>
                  <td style={{ minWidth: 220 }}>
                    <Select aria-label="Product" value={l.product_id} placeholder="Custom item" options={(products.data || []).map((p) => ({ value: p.id, label: p.name }))}
                      onChange={(e) => { const p = products.data.find((x) => x.id === e.target.value); setLines(lines.map((x, j) => (j === i ? { ...x, product_id: e.target.value, name: p?.name || x.name, unit_price: p ? Number(p.unit_price).toString() : x.unit_price, tax_rate: p ? Number(p.tax_rate).toString() : x.tax_rate, discount_percent: '' } : x))); }} />
                    {!l.product_id && <Input aria-label="Item name" placeholder="Item name" value={l.name} onChange={(e) => set(i, 'name', e.target.value)} style={{ marginTop: 4 }} />}
                  </td>
                  <td><Input aria-label="Quantity" type="number" step="any" min="0" value={l.quantity} onChange={(e) => set(i, 'quantity', e.target.value)} style={{ width: 80 }} /></td>
                  <td><Input aria-label="Unit price" type="number" step="any" min="0" value={l.unit_price} onChange={(e) => set(i, 'unit_price', e.target.value)} style={{ width: 110 }} /></td>
                  <td><Input aria-label="Discount" type="number" step="any" min="0" max="100" placeholder="auto" value={l.discount_percent} onChange={(e) => set(i, 'discount_percent', e.target.value)} style={{ width: 80 }} /></td>
                  <td><Input aria-label="Tax rate" type="number" step="any" min="0" max="100" value={l.tax_rate} onChange={(e) => set(i, 'tax_rate', e.target.value)} style={{ width: 70 }} /></td>
                  <td className="right subtle">save to calculate</td>
                  <td><Button size="sm" variant="ghost" icon={Trash2} aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))} /></td>
                </tr>
              ) : (
                <tr key={l.id}><td>{l.name}</td><td>{Number(l.quantity)}</td><td>{money(l.unit_price, quote.currency)}</td><td>{Number(l.discount_percent)}%</td><td>{Number(l.tax_rate)}%</td><td className="right">{money(l.line_total, quote.currency)}</td><td /></tr>
              ))}
            </tbody>
          </table></div>
          {editable && <div className="card-body"><Button size="sm" icon={Plus} onClick={() => setLines([...lines, { product_id: '', name: '', quantity: '1', unit_price: '0', discount_percent: '', tax_rate: '0' }])}>Add line</Button><span className="small subtle" style={{ marginLeft: 12 }}>Leave discount empty to apply matching discount rules automatically.</span></div>}
          <div className="card-body" style={{ borderTop: '1px solid var(--border)' }}>
            <DescriptionList items={[['Subtotal', money(quote.subtotal, quote.currency)], ['Discount', `− ${money(quote.discount_total, quote.currency)}`], ['Tax', money(quote.tax_total, quote.currency)], ['Total', <strong key="t" style={{ fontSize: 18 }}>{money(quote.total, quote.currency)}</strong>]]} />
          </div>
        </Card>
        <div className="stack">
          <Card title="Quote details">
            {editable ? (
              <div className="stack">
                <TextField label="Title" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
                <TextField label="Valid until" type="date" value={meta.valid_until} onChange={(e) => setMeta({ ...meta, valid_until: e.target.value })} />
                <TextField as="textarea" label="Terms" value={meta.terms} onChange={(e) => setMeta({ ...meta, terms: e.target.value })} />
                <TextField as="textarea" label="Internal notes" value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} />
              </div>
            ) : (
              <DescriptionList items={[['Title', quote.title], ['Valid until', date(quote.valid_until)], ['Opportunity', quote.opportunity && <Link to={`/opportunities/${quote.opportunity.id}`}>{quote.opportunity.name}</Link>], ['Owner', quote.owner?.name], ['Approved', quote.approved_at && dateTime(quote.approved_at)], ['Sent', quote.sent_at && dateTime(quote.sent_at)], ['Terms', quote.terms]]} />
            )}
          </Card>
          <Card title="Revisions">
            <ul className="stack sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {(revisions.data || []).map((r) => <li key={r.id} className="row between small"><Link to={`/quotes/${r.id}`}>Revision {r.revision}</Link><Badge value={r.status} /><span>{money(r.total, quote.currency)}</span></li>)}
            </ul>
          </Card>
        </div>
      </div>
      <Modal open={reject} onClose={() => setReject(false)} title="Reject quote" footer={<><Button onClick={() => setReject(false)}>Cancel</Button><Button variant="danger" disabled={comment.length < 3} onClick={() => { action.mutate({ name: 'reject', body: { comment } }); setReject(false); }}>Reject</Button></>}>
        <TextField as="textarea" label="Reason (sent to the quote owner)" value={comment} onChange={(e) => setComment(e.target.value)} />
      </Modal>
    </>
  );
}

import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, patch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Badge, Button, Card, Checkbox, DescriptionList, Select, TextField } from '../../components/ui';
import { RecordPage } from '../entities/RecordPage';
import { dateTime, fullName, relative } from '../../utils/format';

function Conversation({ ticket }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const comments = useQuery({ queryKey: ['ticket-comments', ticket.id], queryFn: () => get(`/tickets/${ticket.id}/comments`).then((r) => r.data) });
  const add = useMutation({
    mutationFn: () => post(`/tickets/${ticket.id}/comments`, { body, is_internal: internal }),
    onSuccess: () => { setBody(''); qc.invalidateQueries({ queryKey: ['ticket-comments', ticket.id] }); qc.invalidateQueries({ queryKey: ['tickets', ticket.id] }); qc.invalidateQueries({ queryKey: ['timeline'] }); },
    onError: (e) => toast.error(e),
  });
  return (
    <div className="stack">
      {ticket.description && <Card title="Original request"><div style={{ whiteSpace: 'pre-wrap' }}>{ticket.description}</div></Card>}
      {(comments.data || []).map((c) => (
        <div key={c.id} className="card" style={{ borderLeft: `4px solid ${c.is_internal ? 'var(--warning)' : 'var(--brand)'}` }}>
          <div className="card-body stack sm">
            <div className="row between small"><strong>{c.author ? `${c.author.first_name} ${c.author.last_name}` : 'System'}</strong><span className="subtle">{c.is_internal ? 'Internal note · ' : 'Reply · '}{relative(c.created_at)}</span></div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div>
          </div>
        </div>
      ))}
      {can('tickets:update') && (
        <form className="card card-body stack" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <TextField as="textarea" label={internal ? 'Internal note (not visible to the customer)' : 'Reply to customer'} rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="row between">
            <Checkbox label="Internal note" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
            <Button type="submit" variant="primary" disabled={!body.trim()} loading={add.isPending}>{internal ? 'Add note' : 'Send reply'}</Button>
          </div>
          <span className="small subtle">Replies are recorded on the ticket; emailing the customer requires a connected email provider.</span>
        </form>
      )}
    </div>
  );
}

export function TicketDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const setStatus = useMutation({ mutationFn: (status) => patch(`/tickets/${id}`, { status }), onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }), onError: (e) => toast.error(e) });
  return (
    <RecordPage entityType="ticket" id={id}
      headerExtra={(r) => <><Badge value={r.status} /><Badge value={r.priority} /><Badge value={r.sla_status}>SLA {r.sla_status.replace('_', ' ')}</Badge></>}
      composerLinks={(r) => ({ ticket_id: r.id, ...(r.contact ? { contact_id: r.contact.id } : {}) })}
      actions={(r) => can('tickets:update') && (
        <Select aria-label="Change status" value={r.status} onChange={(e) => setStatus.mutate(e.target.value)} options={['new', 'open', 'pending', 'on_hold', 'resolved', 'closed'].map((s) => ({ value: s, label: s.replace('_', ' ') }))} />
      )}
      tabs={[{ value: 'conversation', label: 'Conversation', render: (r) => <Conversation ticket={r} /> }]}
      details={(r) => (
        <Card title="Ticket">
          <DescriptionList items={[
            ['Requester', r.contact && <Link to={`/contacts/${r.contact.id}`}>{fullName(r.contact)}</Link>], ['Account', r.account && <Link to={`/accounts/${r.account.id}`}>{r.account.name}</Link>],
            ['Category', r.category?.name], ['Channel', r.channel], ['Assignee', r.owner?.name], ['SLA policy', r.slaPolicy?.name],
            ['First response due', dateTime(r.first_response_due_at)], ['First responded', dateTime(r.first_responded_at)],
            ['Resolve by', dateTime(r.resolution_due_at)], ['Resolved', dateTime(r.resolved_at)], ['Escalation level', r.escalation_level || '—'],
          ]} />
        </Card>
      )} />
  );
}

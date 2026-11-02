import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus } from 'lucide-react';
import { get, post, patch, put, download } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Badge, Button, Card, EmptyState, Modal, Select, Input, TextField } from '../../components/ui';
import { Pagination } from '../../components/data/DataTable';
import { dateTime } from '../../utils/format';

export function TemplatesSettings() {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const list = useQuery({ queryKey: ['email-templates'], queryFn: () => get('/email-templates').then((r) => r.data) });
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const save = useMutation({
    mutationFn: (t) => (t.id ? patch(`/email-templates/${t.id}`, { name: t.name, subject: t.subject, body_html: t.body_html, category: t.category }) : post('/email-templates', { key: t.key, name: t.name, subject: t.subject, body_html: t.body_html, category: t.category })),
    onSuccess: () => { toast.success('Template saved (HTML sanitised)'); setEditing(null); qc.invalidateQueries({ queryKey: ['email-templates'] }); }, onError: (e) => toast.error(e),
  });
  return (
    <Card title="Email templates" actions={can('settings:manage') && <Button variant="primary" icon={Plus} onClick={() => setEditing({ key: '', name: '', subject: '', body_html: '<p>Hi {{first_name}},</p>', category: 'sales' })}>New template</Button>} flush>
      {!list.data?.length ? <EmptyState title="No templates" /> : (
        <table className="table"><tbody>{list.data.map((t) => <tr key={t.id}><td><strong>{t.name}</strong><div className="small subtle mono">{t.key}</div></td><td>{t.subject}</td><td><Badge>{t.category}</Badge></td>
          <td className="right"><Button size="sm" onClick={async () => setPreview((await post(`/email-templates/${t.id}/preview`, {})).data)}>Preview</Button>{can('settings:manage') && <Button size="sm" onClick={() => setEditing(t)}>Edit</Button>}</td></tr>)}</tbody></table>
      )}
      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? 'Edit template' : 'New template'} size="lg" footer={<><Button onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => save.mutate(editing)}>Save</Button></>}>
          <div className="stack">
            <div className="grid cols-3">
              <TextField label="Key" value={editing.key} disabled={!!editing.id} onChange={(e) => setEditing({ ...editing, key: e.target.value })} />
              <TextField label="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <TextField as="select" label="Category" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} options={['sales', 'marketing', 'support']} />
            </div>
            <TextField label="Subject" value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} />
            <TextField as="textarea" rows={10} label="HTML body" value={editing.body_html} onChange={(e) => setEditing({ ...editing, body_html: e.target.value })} hint="Variables: {{first_name}}, {{last_name}}, {{company}}, {{sender_name}}. Scripts and event handlers are removed." />
          </div>
        </Modal>
      )}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.subject || 'Preview'}>
        {/* Sanitised server-side and rendered in a sandboxed frame without script execution. */}
        <iframe title="Template preview" sandbox="" srcDoc={preview?.html} style={{ width: '100%', height: 320, border: '1px solid var(--border)', borderRadius: 8, background: '#fff' }} />
      </Modal>
    </Card>
  );
}

export function SupportSettings() {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const slas = useQuery({ queryKey: ['sla'], queryFn: () => get('/tickets/sla-policies').then((r) => r.data) });
  const cats = useQuery({ queryKey: ['ticket-categories'], queryFn: () => get('/tickets/categories').then((r) => r.data) });
  const [edits, setEdits] = useState({});
  const [cat, setCat] = useState('');
  const save = useMutation({ mutationFn: ({ id, ...b }) => put(`/tickets/sla-policies/${id}`, b), onSuccess: () => { toast.success('SLA saved'); qc.invalidateQueries({ queryKey: ['sla'] }); }, onError: (e) => toast.error(e) });
  const addCat = useMutation({ mutationFn: () => post('/tickets/categories', { name: cat }), onSuccess: () => { setCat(''); qc.invalidateQueries({ queryKey: ['ticket-categories'] }); }, onError: (e) => toast.error(e) });
  const editable = can('settings:manage');
  return (
    <div className="stack">
      <Card title="SLA policies" flush>
        <table className="table"><thead><tr><th>Priority</th><th>First response (minutes)</th><th>Resolution (minutes)</th><th /></tr></thead>
          <tbody>{(slas.data || []).map((s) => {
            const e = { first_response_minutes: s.first_response_minutes, resolution_minutes: s.resolution_minutes, ...edits[s.id] };
            return (
              <tr key={s.id}><td><Badge value={s.priority} /> {s.name}</td>
                <td><Input aria-label="First response minutes" type="number" min={1} disabled={!editable} value={e.first_response_minutes} onChange={(ev) => setEdits({ ...edits, [s.id]: { ...e, first_response_minutes: Number(ev.target.value) } })} /></td>
                <td><Input aria-label="Resolution minutes" type="number" min={1} disabled={!editable} value={e.resolution_minutes} onChange={(ev) => setEdits({ ...edits, [s.id]: { ...e, resolution_minutes: Number(ev.target.value) } })} /></td>
                <td>{editable && edits[s.id] && <Button size="sm" variant="primary" onClick={() => save.mutate({ id: s.id, ...e })}>Save</Button>}</td></tr>
            );
          })}</tbody></table>
        <p className="small subtle card-body" style={{ margin: 0 }}>SLA timers run 24×7 (business-hours calendars are on the roadmap). Breaches escalate to the assignee, the team manager and the policy contact.</p>
      </Card>
      <Card title="Ticket categories">
        <div className="row">{(cats.data || []).map((c) => <Badge key={c.id}>{c.name}</Badge>)}</div>
        {editable && <div className="row" style={{ marginTop: 12 }}><Input aria-label="New category" placeholder="New category" value={cat} onChange={(e) => setCat(e.target.value)} /><Button disabled={!cat} onClick={() => addCat.mutate()}>Add</Button></div>}
      </Card>
    </div>
  );
}

export function AuditSettings() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const params = { page, ...(action ? { action } : {}), ...(entity ? { entity_type: entity } : {}) };
  const q = useQuery({ queryKey: ['audit', params], queryFn: () => get('/audit-logs', params), placeholderData: keepPreviousData });
  const [detail, setDetail] = useState(null);
  return (
    <Card title="Audit log" actions={<Button icon={Download} onClick={() => download('/audit-logs/export', params, 'audit-log.csv').catch((e) => toast.error(e))}>Export</Button>} flush>
      <div className="toolbar">
        <Input aria-label="Action filter" placeholder="Action, e.g. lead.* or auth.login" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} style={{ width: 260 }} />
        <Select aria-label="Entity type" value={entity} placeholder="Any object" onChange={(e) => { setEntity(e.target.value); setPage(1); }} options={['lead', 'contact', 'account', 'opportunity', 'activity', 'ticket', 'quote', 'user', 'role', 'tenant', 'integration', 'workflow', 'custom_field', 'api_key', 'webhook']} />
      </div>
      <table className="table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Summary</th><th>IP</th></tr></thead>
        <tbody>{(q.data?.data || []).map((l) => (
          <tr key={l.id} className="clickable" onClick={() => setDetail(l)}><td className="small nowrap">{dateTime(l.created_at)}</td><td className="small">{l.actor ? `${l.actor.first_name} ${l.actor.last_name}` : l.actor_label || l.actor_type}</td><td className="mono">{l.action}</td><td>{l.summary}</td><td className="small subtle">{l.ip}</td></tr>
        ))}</tbody></table>
      <Pagination meta={q.data?.meta} onPage={setPage} />
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.action} size="lg">
        <pre className="mono small" style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify({ summary: detail?.summary, changes: detail?.changes, metadata: detail?.metadata, request_id: detail?.request_id, user_agent: detail?.user_agent }, null, 2)}</pre>
      </Modal>
    </Card>
  );
}

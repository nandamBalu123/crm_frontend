import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { get, post, put, patch, del } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useMembers } from '../../hooks/useCustomFields';
import { Alert, Badge, Button, Card, Checkbox, EmptyState, Input, Modal, Select, Tabs, TextField } from '../../components/ui';
import { dateTime, relative, fullName, titleCase } from '../../utils/format';

const OPS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'contains', 'is_empty', 'is_not_empty', 'is_true', 'changed', 'changed_to', 'older_than_days'];
const ACTION_TYPES = { create_task: 'Create task', update_field: 'Update a field', assign_owner: 'Assign owner', notify: 'In-app notification', send_email: 'Send email template', slack_message: 'Post to Slack', webhook: 'Call webhook' };

function ActionEditor({ action, onChange, onRemove, members, templates }) {
  const p = action.params || {};
  const set = (k, v) => onChange({ ...action, params: { ...p, [k]: v } });
  return (
    <div className="card card-body stack sm">
      <div className="row between"><Select aria-label="Action type" value={action.type} onChange={(e) => onChange({ type: e.target.value, params: {} })} options={Object.entries(ACTION_TYPES).map(([value, label]) => ({ value, label }))} /><Button size="sm" variant="ghost" icon={Trash2} aria-label="Remove action" onClick={onRemove} /></div>
      {action.type === 'create_task' && <div className="grid cols-3"><Input aria-label="Task subject" placeholder="Task subject" value={p.subject || ''} onChange={(e) => set('subject', e.target.value)} /><Input aria-label="Due in days" type="number" min={0} placeholder="Due in days" value={p.due_in_days ?? 1} onChange={(e) => set('due_in_days', Number(e.target.value))} /><Select aria-label="Assign to" value={p.assign_to || 'record_owner'} onChange={(e) => set('assign_to', e.target.value)} options={[{ value: 'record_owner', label: 'Record owner' }, { value: 'trigger_user', label: 'User who triggered' }, ...members.map((m) => ({ value: m.user_id, label: fullName(m.user) }))]} /></div>}
      {action.type === 'update_field' && <div className="grid cols-2"><Input aria-label="Field" placeholder="field (e.g. rating)" value={p.field || ''} onChange={(e) => set('field', e.target.value)} /><Input aria-label="Value" placeholder="value" value={p.value ?? ''} onChange={(e) => set('value', e.target.value)} /></div>}
      {action.type === 'assign_owner' && <div className="stack sm"><Select aria-label="Strategy" value={p.strategy || 'round_robin'} onChange={(e) => set('strategy', e.target.value)} options={[{ value: 'round_robin', label: 'Round robin' }, { value: 'user', label: 'Specific user' }]} /><div className="row">{members.map((m) => <Checkbox key={m.user_id} label={fullName(m.user)} checked={(p.user_ids || []).includes(m.user_id)} onChange={(e) => set('user_ids', e.target.checked ? [...(p.user_ids || []), m.user_id] : (p.user_ids || []).filter((x) => x !== m.user_id))} />)}</div></div>}
      {action.type === 'notify' && <div className="grid cols-2"><Input aria-label="Notification title" placeholder="Title" value={p.title || ''} onChange={(e) => set('title', e.target.value)} /><Select aria-label="Recipient" value={(p.recipients || ['record_owner'])[0]} onChange={(e) => set('recipients', [e.target.value])} options={[{ value: 'record_owner', label: 'Record owner' }, { value: 'trigger_user', label: 'User who triggered' }, ...members.map((m) => ({ value: m.user_id, label: fullName(m.user) }))]} /><Input className="full" aria-label="Message" placeholder="Message" value={p.message || ''} onChange={(e) => set('message', e.target.value)} /></div>}
      {action.type === 'send_email' && <Select aria-label="Template" value={p.template_id || ''} placeholder="Choose template" onChange={(e) => set('template_id', e.target.value)} options={templates.map((t) => ({ value: t.id, label: t.name }))} />}
      {action.type === 'slack_message' && <Input aria-label="Slack message" placeholder="New hot lead: {{record.last_name}}" value={p.text || ''} onChange={(e) => set('text', e.target.value)} />}
      {action.type === 'webhook' && <Input aria-label="Webhook URL" placeholder="https://…" value={p.url || ''} onChange={(e) => set('url', e.target.value)} />}
    </div>
  );
}

function WorkflowModal({ wf, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const members = useMembers();
  const templates = useQuery({ queryKey: ['email-templates'], queryFn: () => get('/email-templates').then((r) => r.data) });
  const [v, setV] = useState(() => wf ? { ...wf, conditions: wf.conditions?.all || [] } : { name: '', entity_type: 'lead', trigger: { type: 'record.created' }, conditions: [], actions: [{ type: 'create_task', params: { subject: 'Follow up', due_in_days: 1, assign_to: 'record_owner' } }], is_active: true });
  const [error, setError] = useState(null);
  const save = useMutation({
    mutationFn: () => {
      const body = { name: v.name, description: v.description || null, entity_type: v.entity_type, trigger: v.trigger, conditions: v.conditions.length ? { all: v.conditions.map((c) => ({ ...c, value: ['gt', 'gte', 'lt', 'lte', 'older_than_days'].includes(c.op) && c.value !== '' ? Number(c.value) : c.op === 'in' ? String(c.value).split(',').map((x) => x.trim()) : c.value })) } : null, actions: v.actions, is_active: v.is_active };
      return wf ? put(`/workflows/${wf.id}`, { ...body, version: wf.version }) : post('/workflows', body);
    },
    onSuccess: () => { toast.success('Workflow saved'); qc.invalidateQueries({ queryKey: ['workflows'] }); onClose(); },
    onError: (e) => setError(e.details?.length ? e.details.map((d) => `${d.path}: ${d.message}`).join('; ') : e.message),
  });
  const t = v.trigger;
  return (
    <Modal open onClose={onClose} title={wf ? `Edit workflow · ${wf.name}` : 'New workflow'} size="lg" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>Save workflow</Button></>}>
      <div className="stack">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid cols-2">
          <TextField label="Name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          <TextField as="select" label="Object" value={v.entity_type} onChange={(e) => setV({ ...v, entity_type: e.target.value })} options={['lead', 'contact', 'account', 'opportunity', 'activity', 'ticket', 'quote']} />
        </div>
        <Card title="When">
          <div className="grid cols-3">
            <Select aria-label="Trigger" value={t.type} onChange={(e) => setV({ ...v, trigger: e.target.value === 'scheduled' ? { type: 'scheduled', interval_minutes: 60, once_per_record: true } : e.target.value === 'field.changed' ? { type: 'field.changed', field: 'status' } : { type: e.target.value } })}
              options={[{ value: 'record.created', label: 'Record is created' }, { value: 'record.updated', label: 'Record is updated' }, { value: 'field.changed', label: 'A field changes' }, { value: 'stage.changed', label: 'Deal stage changes' }, { value: 'scheduled', label: 'On a schedule' }]} />
            {t.type === 'field.changed' && <><Input aria-label="Field" placeholder="field" value={t.field} onChange={(e) => setV({ ...v, trigger: { ...t, field: e.target.value } })} /><Input aria-label="To value" placeholder="to value (optional)" value={t.to_value ?? ''} onChange={(e) => setV({ ...v, trigger: { ...t, to_value: e.target.value || undefined } })} /></>}
            {t.type === 'scheduled' && <><Input aria-label="Interval minutes" type="number" min={15} value={t.interval_minutes} onChange={(e) => setV({ ...v, trigger: { ...t, interval_minutes: Number(e.target.value) } })} /><Checkbox label="Once per record" checked={t.once_per_record !== false} onChange={(e) => setV({ ...v, trigger: { ...t, once_per_record: e.target.checked } })} /></>}
          </div>
        </Card>
        <Card title="Only if (all conditions match)" actions={<Button size="sm" icon={Plus} onClick={() => setV({ ...v, conditions: [...v.conditions, { field: 'status', op: 'eq', value: '' }] })}>Condition</Button>}>
          {!v.conditions.length && <span className="small subtle">No conditions — runs for every matching trigger.</span>}
          {v.conditions.map((c, i) => (
            <div key={i} className="row" style={{ marginBottom: 6 }}>
              <Input aria-label="Field" value={c.field} onChange={(e) => setV({ ...v, conditions: v.conditions.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)) })} placeholder="field or custom_fields.key" />
              <Select aria-label="Operator" value={c.op} onChange={(e) => setV({ ...v, conditions: v.conditions.map((x, j) => (j === i ? { ...x, op: e.target.value } : x)) })} options={OPS.map((o) => ({ value: o, label: o.replace(/_/g, ' ') }))} />
              {!['is_empty', 'is_not_empty', 'is_true', 'changed'].includes(c.op) && <Input aria-label="Value" value={c.value} onChange={(e) => setV({ ...v, conditions: v.conditions.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} placeholder="value" />}
              <Button size="sm" variant="ghost" icon={Trash2} aria-label="Remove condition" onClick={() => setV({ ...v, conditions: v.conditions.filter((_, j) => j !== i) })} />
            </div>
          ))}
        </Card>
        <Card title="Then" actions={v.actions.length < 10 && <Button size="sm" icon={Plus} onClick={() => setV({ ...v, actions: [...v.actions, { type: 'notify', params: { recipients: ['record_owner'], title: 'Workflow alert' } }] })}>Action</Button>}>
          <div className="stack">{v.actions.map((a, i) => <ActionEditor key={i} action={a} members={members.data || []} templates={templates.data || []} onChange={(na) => setV({ ...v, actions: v.actions.map((x, j) => (j === i ? na : x)) })} onRemove={() => setV({ ...v, actions: v.actions.filter((_, j) => j !== i) })} />)}</div>
        </Card>
        <span className="small subtle">Automations run declarative, whitelisted actions only — no custom code. Loops are stopped after 3 chained runs.</span>
      </div>
    </Modal>
  );
}

export function WorkflowsSettings() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState('workflows');
  const [editing, setEditing] = useState(null);
  const list = useQuery({ queryKey: ['workflows'], queryFn: () => get('/workflows').then((r) => r.data) });
  const runs = useQuery({ queryKey: ['workflow-runs'], queryFn: () => get('/workflows/runs').then((r) => r.data), enabled: tab === 'runs' });
  const toggle = useMutation({ mutationFn: (w) => patch(`/workflows/${w.id}`, { is_active: !w.is_active }), onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }) });
  const remove = useMutation({ mutationFn: (id) => del(`/workflows/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }) });
  const retry = useMutation({ mutationFn: (id) => post(`/workflows/runs/${id}/retry`), onSuccess: (r) => { toast.info(`Retry ${r.data.status}`); qc.invalidateQueries({ queryKey: ['workflow-runs'] }); }, onError: (e) => toast.error(e) });
  const names = Object.fromEntries((list.data || []).map((w) => [w.id, w.name]));
  return (
    <Card title="Workflow automation" actions={can('workflows:create') && <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>New workflow</Button>} flush>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'workflows', label: 'Workflows' }, { value: 'runs', label: 'Execution history' }]} />
      {tab === 'workflows' && (!list.data?.length ? <EmptyState title="No workflows" message="Automate assignment, follow-ups and notifications." /> : (
        <table className="table"><thead><tr><th>Name</th><th>Object</th><th>Trigger</th><th>Actions</th><th>Runs</th><th>Status</th><th /></tr></thead>
          <tbody>{list.data.map((w) => (
            <tr key={w.id}><td><strong>{w.name}</strong></td><td>{w.entity_type}</td><td>{w.trigger.type}</td><td>{w.actions.map((a) => ACTION_TYPES[a.type]).join(', ')}</td>
              <td>{w.run_count}{w.failure_count > 0 && <Badge tone="danger">{w.failure_count} failed</Badge>}<div className="small subtle">{w.last_run_at && relative(w.last_run_at)}</div></td>
              <td><Badge value={w.is_active ? 'active' : 'disabled'} /></td>
              <td className="right nowrap">{can('workflows:update') && <><Button size="sm" onClick={() => setEditing(w)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => toggle.mutate(w)}>{w.is_active ? 'Disable' : 'Enable'}</Button></>}{can('workflows:delete') && <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Delete ${w.name}`} onClick={() => remove.mutate(w.id)} />}</td></tr>
          ))}</tbody></table>
      ))}
      {tab === 'runs' && (
        <table className="table"><thead><tr><th>When</th><th>Workflow</th><th>Record</th><th>Status</th><th>Steps</th><th /></tr></thead>
          <tbody>{(runs.data || []).map((r) => (
            <tr key={r.id}><td className="small">{dateTime(r.created_at)}</td><td>{names[r.workflow_id] || '—'}</td><td className="small">{r.entity_type}</td><td><Badge value={r.status} /></td>
              <td className="small" style={{ whiteSpace: 'normal' }}>{(r.steps || []).map((s) => `${titleCase(s.type)}: ${s.status}`).join(' → ')}{r.error && <div className="error">{r.error}</div>}</td>
              <td>{r.status === 'failed' && can('workflows:update') && <Button size="sm" icon={RotateCcw} onClick={() => retry.mutate(r.id)}>Retry</Button>}</td></tr>
          ))}</tbody></table>
      )}
      {editing && <WorkflowModal wf={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

import { useRef, useState } from 'react';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CheckSquare, FileText, Mail, Paperclip, Phone, Trash2, Upload, Download, Zap, Clock } from 'lucide-react';
import { api, get, post, del, patch, download } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCustomFields } from '../../hooks/useCustomFields';
import { formatCustomValue } from '../../components/forms/CustomFieldInput';
import { Button, Card, DescriptionList, Drawer, EmptyState, Skeleton, Tabs, TextField, Badge, Alert } from '../../components/ui';
import { EntityForm, buildPayload } from './EntityForm';
import { ENTITIES } from './config';
import { fieldAccess } from '../../permissions/can';
import { dateTime, relative, titleCase, fromLocalInput } from '../../utils/format';

export function useRecord(entityType, id) {
  const cfg = ENTITIES[entityType];
  return useQuery({ queryKey: [cfg.route, id], queryFn: () => get(`/${cfg.route}/${id}`).then((r) => r.data), enabled: !!id });
}

/** Picks editable values from a record for the edit form. */
export function editValues(entityType, record) {
  const cfg = ENTITIES[entityType];
  const v = Object.fromEntries(cfg.fields.map((f) => [f.key, record?.[f.key] ?? (f.type === 'checkbox' ? false : '')]));
  v.owner_id = record?.owner?.id || record?.owner_id || '';
  v.custom_fields = { ...(record?.custom_fields || {}) };
  return v;
}

export function EditDrawer({ entityType, record, open, onClose }) {
  const cfg = ENTITIES[entityType];
  const qc = useQueryClient();
  const toast = useToast();
  const [values, setValues] = useState(() => editValues(entityType, record));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const save = useMutation({
    mutationFn: () => patch(`/${cfg.route}/${record.id}`, { ...buildPayload(values, editValues(entityType, record)), version: record.version }),
    onSuccess: () => {
      toast.success('Changes saved');
      qc.invalidateQueries({ queryKey: [cfg.route] });
      qc.invalidateQueries({ queryKey: ['timeline', entityType, record.id] });
      onClose();
    },
    onError: (err) => {
      setErrors(err.fieldErrors?.() || {});
      setFormError(err.code === 'VERSION_CONFLICT' ? 'Someone else changed this record. Close and reopen to load the latest version.' : err.details?.length ? 'Please fix the highlighted fields.' : err.message);
    },
  });
  return (
    <Drawer open={open} onClose={onClose} title={`Edit ${cfg.label.toLowerCase()}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <EntityForm entityType={entityType} record={record} values={values} onChange={setValues} errors={errors} formError={formError} />
      </form>
    </Drawer>
  );
}

export function CustomFieldsCard({ entityType, record }) {
  const { me } = useAuth();
  const defs = useCustomFields(entityType);
  const visible = (defs.data || []).filter((d) => fieldAccess(me, entityType, `cf.${d.key}`) !== 'hidden');
  if (!visible.length) return null;
  const sections = {};
  for (const d of visible) (sections[d.section || 'Additional details'] = sections[d.section || 'Additional details'] || []).push(d);
  return Object.entries(sections).map(([name, list]) => (
    <Card key={name} title={name}>
      <DescriptionList items={list.map((d) => [d.label, formatCustomValue(d, record.custom_fields?.[d.key])])} />
    </Card>
  ));
}

const TL_ICON = { task: CheckSquare, call: Phone, meeting: CalendarClock, note: FileText, email: Mail, communication: Mail, event: Zap };

export function Timeline({ entityType, id }) {
  const cfg = ENTITIES[entityType];
  const q = useInfiniteQuery({
    queryKey: ['timeline', entityType, id],
    queryFn: ({ pageParam }) => get(`/${cfg.route}/${id}/timeline`, { limit: 25, before: pageParam || undefined }).then((r) => r.data),
    getNextPageParam: (last) => last.next_before || undefined,
    initialPageParam: null,
  });
  if (q.isLoading) return <Skeleton rows={5} />;
  const items = (q.data?.pages || []).flatMap((p) => p.items);
  if (!items.length) return <EmptyState icon={Clock} title="No activity yet" message="Calls, notes, emails and changes will appear here." />;
  return (
    <>
      <ol className="timeline">
        {items.map((it) => {
          const Icon = TL_ICON[it.activity_type || it.kind] || Zap;
          return (
            <li key={`${it.kind}-${it.id}`}>
              <span className={`tl-icon ${it.kind}`}><Icon size={14} aria-hidden /></span>
              <div>
                <div className="row between">
                  <strong>
                    {it.kind === 'event' && it.summary}
                    {it.kind === 'activity' && <>{titleCase(it.activity_type)}: {it.subject} {it.status === 'completed' && <Badge value="completed" />}</>}
                    {it.kind === 'communication' && <>{it.channel === 'email' ? 'Email' : it.channel.toUpperCase()} to {it.to}{it.subject ? `: ${it.subject}` : ''} <Badge value={it.status} /></>}
                  </strong>
                  <span className="small subtle" title={dateTime(it.at)}>{relative(it.at)}</span>
                </div>
                {it.description && <div className="small muted" style={{ whiteSpace: 'pre-wrap' }}>{it.description}</div>}
                <div className="small subtle">{it.actor?.name || it.owner?.name || (it.kind === 'event' ? 'System' : '')}</div>
              </div>
            </li>
          );
        })}
      </ol>
      {q.hasNextPage && <Button size="sm" onClick={() => q.fetchNextPage()} loading={q.isFetchingNextPage}>Load older</Button>}
    </>
  );
}

/** Quick logging composer for notes, calls and tasks linked to a record. */
export function ActivityComposer({ links }) {
  const [tab, setTab] = useState('note');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [due, setDue] = useState('');
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const save = useMutation({
    mutationFn: () => post('/activities', {
      type: tab, subject: subject || (tab === 'note' ? body.slice(0, 80) || 'Note' : tab === 'call' ? 'Call logged' : 'Follow up'),
      description: body || undefined, ...(tab === 'task' && due ? { due_at: fromLocalInput(due) } : {}), ...(tab === 'call' ? { status: 'completed', call_direction: 'outbound' } : {}), ...links,
    }),
    onSuccess: () => {
      setSubject(''); setBody(''); setDue('');
      toast.success(tab === 'note' ? 'Note added' : tab === 'call' ? 'Call logged' : 'Task created');
      qc.invalidateQueries({ queryKey: ['timeline'] });
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
    onError: (e) => toast.error(e),
  });
  if (!can('activities:create')) return null;
  return (
    <Card flush>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'note', label: 'Note' }, { value: 'call', label: 'Log call' }, { value: 'task', label: 'Task' }]} />
      <form className="card-body stack" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        {tab !== 'note' && <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={tab === 'call' ? 'Discovery call' : 'Send proposal'} />}
        <TextField as="textarea" label={tab === 'note' ? 'Note' : 'Details'} value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
        {tab === 'task' && <TextField type="datetime-local" label="Due" value={due} onChange={(e) => setDue(e.target.value)} />}
        <div className="row end"><Button type="submit" variant="primary" loading={save.isPending} disabled={!body && !subject}>Save</Button></div>
      </form>
    </Card>
  );
}

export function EmailComposer({ open, onClose, recipient }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [templateId, setTemplateId] = useState('');
  const qc = useQueryClient();
  const toast = useToast();
  const templates = useQuery({ queryKey: ['email-templates'], queryFn: () => get('/email-templates').then((r) => r.data), enabled: open });
  const send = useMutation({
    mutationFn: () => post('/communications', { channel: 'email', ...recipient, subject: subject || undefined, body: body ? `<p>${body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>` : undefined, template_id: templateId || undefined }),
    onSuccess: (res) => {
      const s = res.data.status;
      if (s === 'blocked') toast.warning(`Not sent: ${res.data.status_reason}`);
      else toast.success('Email queued for delivery. Delivery status appears on the timeline.');
      qc.invalidateQueries({ queryKey: ['timeline'] });
      onClose();
    },
    onError: (e) => toast.error(e),
  });
  return (
    <Drawer open={open} onClose={onClose} title="Send email"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={Mail} loading={send.isPending} disabled={!templateId && !body} onClick={() => send.mutate()}>Send</Button></>}>
      <div className="stack">
        <Alert>Emails are sent through your workspace's connected email provider (Settings → Integrations). Recipients who opted out are never emailed.</Alert>
        <TextField as="select" label="Template" value={templateId} onChange={(e) => setTemplateId(e.target.value)} placeholder="No template" options={(templates.data || []).map((t) => ({ value: t.id, label: t.name }))} />
        <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} hint={templateId ? 'Leave empty to use the template subject' : 'Use {{first_name}} to personalise'} />
        <TextField as="textarea" label="Message" rows={10} value={body} onChange={(e) => setBody(e.target.value)} hint={templateId ? 'Leave empty to use the template body' : undefined} />
      </div>
    </Drawer>
  );
}

export function FilesPanel({ entityType, id }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const input = useRef(null);
  const files = useQuery({ queryKey: ['files', entityType, id], queryFn: () => get('/attachments', { entity_type: entityType, entity_id: id }).then((r) => r.data) });
  const upload = useMutation({
    mutationFn: (file) => {
      const form = new FormData();
      form.append('entity_type', entityType);
      form.append('entity_id', id);
      form.append('file', file);
      return api.post('/attachments', form);
    },
    onSuccess: () => { toast.success('File uploaded'); qc.invalidateQueries({ queryKey: ['files', entityType, id] }); qc.invalidateQueries({ queryKey: ['timeline'] }); },
    onError: (e) => toast.error(e),
  });
  const remove = useMutation({ mutationFn: (fid) => del(`/attachments/${fid}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['files', entityType, id] }), onError: (e) => toast.error(e) });
  return (
    <Card title="Files" actions={can('files:create') && <>
      <input ref={input} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.docx,.xlsx,.pptx,.csv,.txt" onChange={(e) => { if (e.target.files[0]) upload.mutate(e.target.files[0]); e.target.value = ''; }} />
      <Button size="sm" icon={Upload} loading={upload.isPending} onClick={() => input.current.click()}>Upload</Button>
    </>}>
      {files.isLoading ? <Skeleton /> : !files.data?.length ? <EmptyState icon={Paperclip} title="No files" message="PDF, images, Office documents, CSV and text up to 10 MB." /> : (
        <ul className="stack sm" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {files.data.map((f) => (
            <li key={f.id} className="row between">
              <div className="grow"><div className="truncate"><strong>{f.filename}</strong></div><div className="small subtle">{(Number(f.size_bytes) / 1024).toFixed(0)} KB · {relative(f.created_at)}</div></div>
              <Button size="sm" variant="ghost" icon={Download} aria-label={`Download ${f.filename}`} onClick={() => download(`/attachments/${f.id}/download`, undefined, f.filename).catch((e) => toast.error(e))} />
              {can('files:delete') && <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Delete ${f.filename}`} onClick={() => remove.mutate(f.id)} />}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function RelatedTable({ title, block, columns, emptyLabel, action }) {
  if (!block) return null;
  if (!block.allowed) return <Card title={title}><span className="small subtle">You do not have access to {title.toLowerCase()}.</span></Card>;
  return (
    <Card title={<h3>{title} <span className="badge">{block.total}</span></h3>} actions={action} flush>
      {!block.items.length ? <div className="card-body small subtle">{emptyLabel || `No ${title.toLowerCase()}`}</div> : (
        <div className="table-wrap"><table className="table"><tbody>
          {block.items.map((r) => <tr key={r.id}>{columns.map((c) => <td key={c.key}>{c.render ? c.render(r) : r[c.key]}</td>)}</tr>)}
        </tbody></table></div>
      )}
    </Card>
  );
}

export function OwnerHistory({ entityType, id }) {
  const cfg = ENTITIES[entityType];
  const q = useQuery({ queryKey: ['assignments', entityType, id], queryFn: () => get(`/${cfg.route}/${id}/assignments`).then((r) => r.data) });
  if (!q.data?.length) return null;
  return (
    <Card title="Ownership history">
      <ul className="stack sm" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {q.data.map((a) => <li key={a.id} className="small"><strong>{a.toOwner ? `${a.toOwner.first_name} ${a.toOwner.last_name}` : 'Unassigned'}</strong> <span className="subtle">from {a.fromOwner ? `${a.fromOwner.first_name} ${a.fromOwner.last_name}` : '—'} · {relative(a.created_at)}{a.reason ? ` · ${a.reason}` : ''}</span></li>)}
      </ul>
    </Card>
  );
}



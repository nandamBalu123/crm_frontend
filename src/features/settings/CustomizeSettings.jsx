import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { get, post, patch, put, del } from '../../api/client';

import { useToast } from '../../context/ToastContext';
import { Alert, Badge, Button, Card, Checkbox, ConfirmDialog, EmptyState, Modal, Skeleton, Tabs, TextField, Input, Select } from '../../components/ui';
import { titleCase } from '../../utils/format';

const ENTITY_TYPES = ['lead', 'contact', 'account', 'opportunity', 'activity', 'ticket', 'product', 'quote', 'campaign'];
const TYPE_LABELS = { text: 'Short text', textarea: 'Long text', integer: 'Integer', decimal: 'Decimal', currency: 'Currency', percent: 'Percentage', boolean: 'Yes / No', date: 'Date', datetime: 'Date & time', select: 'Single select', multiselect: 'Multi-select', email: 'Email', phone: 'Phone', url: 'URL', user: 'User reference', file: 'File reference' };

function FieldModal({ entityType, field, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [v, setV] = useState(() => field ? { ...field, validation: field.validation || {}, options: field.options || [] } : { label: '', key: '', field_type: 'text', is_required: false, is_searchable: false, is_filterable: true, show_in_list: false, section: '', description: '', placeholder: '', validation: {}, options: [], default_value: '' });
  const [errors, setErrors] = useState({});
  const save = useMutation({
    mutationFn: () => {
      const body = {
        label: v.label, description: v.description || null, placeholder: v.placeholder || null, section: v.section || null, is_required: v.is_required, is_searchable: v.is_searchable, is_filterable: v.is_filterable, show_in_list: v.show_in_list,
        validation: Object.fromEntries(Object.entries(v.validation).filter(([, x]) => x !== '' && x !== null && x !== undefined)),
        ...(['select', 'multiselect'].includes(v.field_type) ? { options: v.options.filter((o) => o.value) } : {}),
        ...(v.default_value !== '' && v.default_value !== undefined ? { default_value: v.default_value } : {}),
      };
      return field ? patch(`/custom-fields/${field.id}`, { ...body, version: field.version }) : post('/custom-fields', { ...body, entity_type: entityType, field_type: v.field_type, ...(v.key ? { key: v.key } : {}) });
    },
    onSuccess: () => { toast.success('Field saved'); qc.invalidateQueries({ queryKey: ['custom-fields'] }); onClose(); },
    onError: (e) => { setErrors(e.fieldErrors?.() || {}); toast.error(e); },
  });
  const numeric = ['integer', 'decimal', 'currency', 'percent'].includes(v.field_type);
  const texty = ['text', 'textarea'].includes(v.field_type);
  const setVal = (k, x) => setV({ ...v, validation: { ...v.validation, [k]: x } });
  return (
    <Modal open onClose={onClose} title={field ? `Edit field · ${field.label}` : `New ${entityType} field`} size="lg" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>Save field</Button></>}>
      <div className="form-grid">
        <TextField label="Label" required value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} error={errors.label} />
        <TextField label="Internal key" value={v.key} disabled={!!field} onChange={(e) => setV({ ...v, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} hint={field ? 'Keys are immutable.' : 'Optional. Generated from the label.'} error={errors.key} />
        <TextField as="select" label="Type" value={v.field_type} disabled={!!field} onChange={(e) => setV({ ...v, field_type: e.target.value })} options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))} hint={field ? 'Type cannot change once created (protects stored data).' : undefined} />
        <TextField label="Section" value={v.section || ''} onChange={(e) => setV({ ...v, section: e.target.value })} hint="Groups fields on forms and detail pages." />
        <TextField className="full" label="Help text" value={v.description || ''} onChange={(e) => setV({ ...v, description: e.target.value })} />
        {numeric && <><TextField type="number" label="Minimum" value={v.validation.min ?? ''} onChange={(e) => setVal('min', e.target.value)} /><TextField type="number" label="Maximum" value={v.validation.max ?? ''} onChange={(e) => setVal('max', e.target.value)} /></>}
        {texty && <><TextField type="number" label="Min length" value={v.validation.min_length ?? ''} onChange={(e) => setVal('min_length', e.target.value)} /><TextField type="number" label="Max length" value={v.validation.max_length ?? ''} onChange={(e) => setVal('max_length', e.target.value)} /></>}
        {!['select', 'multiselect', 'boolean', 'user', 'file'].includes(v.field_type) && <TextField label="Default value" value={v.default_value ?? ''} onChange={(e) => setV({ ...v, default_value: e.target.value })} error={errors.default_value} />}
        {['select', 'multiselect'].includes(v.field_type) && (
          <div className="full stack sm">
            <span className="label">Options</span>
            {v.options.map((o, i) => (
              <div key={i} className="row">
                <Input aria-label="Option label" placeholder="Label" value={o.label} onChange={(e) => setV({ ...v, options: v.options.map((x, j) => (j === i ? { ...x, label: e.target.value, value: field && x.value ? x.value : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_') } : x)) })} />
                <span className="mono small">{o.value}</span>{o.is_active === false && <Badge tone="warning">inactive (in use)</Badge>}
                <Button size="sm" variant="ghost" icon={Trash2} aria-label="Remove option" onClick={() => setV({ ...v, options: v.options.filter((_, j) => j !== i) })} />
              </div>
            ))}
            <Button size="sm" icon={Plus} onClick={() => setV({ ...v, options: [...v.options, { value: '', label: '' }] })}>Add option</Button>
            {errors.options && <span className="error small">{errors.options}</span>}
          </div>
        )}
        <div className="full row">
          <Checkbox label="Required" checked={v.is_required} onChange={(e) => setV({ ...v, is_required: e.target.checked })} />
          <Checkbox label="Show in list views" checked={v.show_in_list} onChange={(e) => setV({ ...v, show_in_list: e.target.checked })} />
          <Checkbox label="Filterable" checked={v.is_filterable} onChange={(e) => setV({ ...v, is_filterable: e.target.checked })} />
          {['text', 'email', 'phone', 'url', 'select'].includes(v.field_type) && <Checkbox label="Searchable" checked={v.is_searchable} onChange={(e) => setV({ ...v, is_searchable: e.target.checked })} />}
        </div>
      </div>
    </Modal>
  );
}

export function CustomFieldsSettings() {
  const [entity, setEntity] = useState('lead');
  const [editing, setEditing] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const qc = useQueryClient();
  const toast = useToast();
  const list = useQuery({ queryKey: ['custom-fields', entity, 'admin'], queryFn: () => get('/custom-fields', { entity_type: entity, include_inactive: 'true' }).then((r) => r.data) });
  const reorder = useMutation({ mutationFn: (ids) => put('/custom-fields/reorder', { entity_type: entity, ids }), onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-fields'] }) });
  const toggle = useMutation({ mutationFn: (f) => patch(`/custom-fields/${f.id}`, { is_active: !f.is_active }), onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-fields'] }), onError: (e) => toast.error(e) });
  const archive = useMutation({ mutationFn: (f) => del(`/custom-fields/${f.id}`), onSuccess: () => { setArchiving(null); qc.invalidateQueries({ queryKey: ['custom-fields'] }); toast.success('Field archived; stored values are retained'); } });
  const fields = list.data || [];
  const move = (i, d) => { const ids = fields.map((f) => f.id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]]; reorder.mutate(ids); };
  return (
    <Card title="Custom fields" actions={<Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Add field</Button>} flush>
      <Tabs value={entity} onChange={setEntity} tabs={ENTITY_TYPES.map((t) => ({ value: t, label: titleCase(t) }))} />
      {list.isLoading ? <div className="card-body"><Skeleton /></div> : !fields.length ? <EmptyState title={`No custom fields for ${entity}s`} message="Add fields without schema changes or deployments." /> : (
        <table className="table"><thead><tr><th>Order</th><th>Label</th><th>Key</th><th>Type</th><th>Flags</th><th>Status</th><th /></tr></thead>
          <tbody>{fields.map((f, i) => (
            <tr key={f.id}>
              <td><Button size="sm" variant="ghost" icon={ArrowUp} aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} /><Button size="sm" variant="ghost" icon={ArrowDown} aria-label="Move down" disabled={i === fields.length - 1} onClick={() => move(i, 1)} /></td>
              <td><strong>{f.label}</strong>{f.section && <div className="small subtle">{f.section}</div>}</td><td className="mono">{f.key}</td><td>{TYPE_LABELS[f.field_type]}</td>
              <td>{f.is_required && <Badge>required</Badge>}{f.show_in_list && <Badge>list</Badge>}{f.is_searchable && <Badge>search</Badge>}</td>
              <td><Badge value={f.is_active ? 'active' : 'disabled'} /></td>
              <td className="right nowrap"><Button size="sm" onClick={() => setEditing(f)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => toggle.mutate(f)}>{f.is_active ? 'Deactivate' : 'Activate'}</Button><Button size="sm" variant="ghost" icon={Trash2} aria-label={`Archive ${f.label}`} onClick={() => setArchiving(f)} /></td>
            </tr>
          ))}</tbody></table>
      )}
      {editing && <FieldModal entityType={entity} field={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!archiving} onClose={() => setArchiving(null)} title={`Archive "${archiving?.label}"?`} message="The field disappears from forms, lists and APIs. Stored values are kept and can be purged later via the API." confirmLabel="Archive" danger loading={archive.isPending} onConfirm={() => archive.mutate(archiving)} />
    </Card>
  );
}

export function PipelinesSettings() {
  const qc = useQueryClient();
  const toast = useToast();
  const list = useQuery({ queryKey: ['pipelines'], queryFn: () => get('/pipelines').then((r) => r.data) });
  const [sel, setSel] = useState(null);
  const [draft, setDraft] = useState(null);
  const [conflict, setConflict] = useState(null);
  useEffect(() => { if (list.data && !sel) setSel(list.data[0]?.id); }, [list.data, sel]);
  useEffect(() => { const p = list.data?.find((x) => x.id === sel); if (p) setDraft({ name: p.name, is_default: p.is_default, stages: p.stages.map((s) => ({ id: s.id, name: s.name, probability: s.probability, category: s.category, rotting_days: s.rotting_days })) }); }, [sel, list.data]);
  const save = useMutation({
    mutationFn: (moveTo) => (sel === 'new' ? post('/pipelines', draft) : put(`/pipelines/${sel}`, { ...draft, ...(moveTo ? { move_to: moveTo } : {}) })),
    onSuccess: (r) => { toast.success('Pipeline saved'); setConflict(null); qc.invalidateQueries({ queryKey: ['pipelines'] }); setSel(r.data.id); },
    onError: (e) => (e.code === 'STAGE_IN_USE' ? setConflict(e) : toast.error(e)),
  });
  const [moveTarget, setMoveTarget] = useState('');
  if (!draft && sel !== 'new') return <Skeleton />;
  const set = (i, k, val) => setDraft({ ...draft, stages: draft.stages.map((s, j) => (j === i ? { ...s, [k]: val } : s)) });
  return (
    <Card title="Sales pipelines" actions={<>
      <Select aria-label="Pipeline" value={sel || ''} onChange={(e) => setSel(e.target.value)} options={(list.data || []).map((p) => ({ value: p.id, label: p.name }))} />
      <Button icon={Plus} onClick={() => { setSel('new'); setDraft({ name: 'New pipeline', stages: [{ name: 'New', probability: 10, category: 'open' }, { name: 'Won', probability: 100, category: 'won' }, { name: 'Lost', probability: 0, category: 'lost' }] }); }}>New pipeline</Button>
    </>}>
      <div className="stack">
        <div className="row"><TextField label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /><Checkbox label="Default pipeline" checked={!!draft.is_default} onChange={(e) => setDraft({ ...draft, is_default: e.target.checked })} /></div>
        <table className="table"><thead><tr><th /><th>Stage</th><th>Probability %</th><th>Type</th><th>Stalled after (days)</th><th /></tr></thead>
          <tbody>{draft.stages.map((s, i) => (
            <tr key={s.id || i}>
              <td><Button size="sm" variant="ghost" icon={ArrowUp} aria-label="Move up" disabled={!i} onClick={() => { const st = [...draft.stages]; [st[i - 1], st[i]] = [st[i], st[i - 1]]; setDraft({ ...draft, stages: st }); }} /></td>
              <td><Input aria-label="Stage name" value={s.name} onChange={(e) => set(i, 'name', e.target.value)} /></td>
              <td><Input aria-label="Probability" type="number" min={0} max={100} value={s.probability} onChange={(e) => set(i, 'probability', Number(e.target.value))} style={{ width: 90 }} /></td>
              <td><Select aria-label="Stage type" value={s.category} onChange={(e) => set(i, 'category', e.target.value)} options={[{ value: 'open', label: 'Open' }, { value: 'won', label: 'Won' }, { value: 'lost', label: 'Lost' }]} /></td>
              <td><Input aria-label="Stalled after days" type="number" min={1} value={s.rotting_days ?? ''} onChange={(e) => set(i, 'rotting_days', e.target.value ? Number(e.target.value) : null)} style={{ width: 90 }} disabled={s.category !== 'open'} /></td>
              <td><Button size="sm" variant="ghost" icon={Trash2} aria-label="Remove stage" onClick={() => setDraft({ ...draft, stages: draft.stages.filter((_, j) => j !== i) })} /></td>
            </tr>
          ))}</tbody></table>
        <div className="row between"><Button size="sm" icon={Plus} onClick={() => setDraft({ ...draft, stages: [...draft.stages.slice(0, -2), { name: 'New stage', probability: 50, category: 'open' }, ...draft.stages.slice(-2)] })}>Add stage</Button><Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>Save pipeline</Button></div>
        {conflict && (
          <Alert tone="warning">
            {conflict.message}
            <div className="row" style={{ marginTop: 8 }}>
              <Select aria-label="Move deals to" value={moveTarget} placeholder="Move its deals to…" options={draft.stages.filter((s) => s.id).map((s) => ({ value: s.id, label: s.name }))} onChange={(e) => setMoveTarget(e.target.value)} />
              <Button size="sm" disabled={!moveTarget} onClick={() => save.mutate({ [conflict.details.stage_id]: moveTarget })}>Move deals & save</Button>
            </div>
          </Alert>
        )}
      </div>
    </Card>
  );
}

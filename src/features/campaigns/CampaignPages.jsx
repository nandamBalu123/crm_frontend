import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Plus, Trash2, Users } from 'lucide-react';
import { get, post, patch, del } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Badge, Button, Card, Checkbox, DescriptionList, Kpi, Modal, PageHeader, Select, Tabs, TextField, EmptyState, Alert } from '../../components/ui';
import { EntityListPage } from '../entities/EntityListPage';
import { RecordPage } from '../entities/RecordPage';
import { money, percent, fullName, date, relative } from '../../utils/format';

export function MarketingPage() {
  const [tab, setTab] = useState('campaigns');
  return (
    <div className="stack">
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'campaigns', label: 'Campaigns' }, { value: 'forms', label: 'Lead capture forms' }, { value: 'segments', label: 'Segments' }]} />
      {tab === 'campaigns' && <EntityListPage entityType="campaign" />}
      {tab === 'forms' && <FormsList />}
      {tab === 'segments' && <Segments />}
    </div>
  );
}

function Segments() {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const list = useQuery({ queryKey: ['segments'], queryFn: () => get('/campaigns/segments').then((r) => r.data) });
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: '', entity_type: 'contact', field: 'lead_source', value: '' });
  const [preview, setPreview] = useState(null);
  const create = useMutation({
    mutationFn: () => post('/campaigns/segments', { name: v.name, entity_type: v.entity_type, filters: { filter: v.value ? { [v.field]: v.value } : {} } }),
    onSuccess: () => { setOpen(false); qc.invalidateQueries({ queryKey: ['segments'] }); toast.success('Segment created'); }, onError: (e) => toast.error(e),
  });
  const fields = v.entity_type === 'contact' ? ['lead_source', 'country', 'city', 'title', 'department'] : ['status', 'source', 'industry', 'country', 'rating'];
  return (
    <>
      <PageHeader title="Segments" subtitle="Reusable audiences. Opted-out records are always excluded." actions={can('campaigns:create') && <Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>New segment</Button>} />
      <Card flush>
        {!list.data?.length ? <EmptyState icon={Users} title="No segments" /> : (
          <table className="table"><tbody>
            {list.data.map((s) => (
              <tr key={s.id}><td><strong>{s.name}</strong></td><td><Badge>{s.entity_type}</Badge></td><td className="mono small">{JSON.stringify(s.filters.filter || {})}</td>
                <td className="right"><Button size="sm" onClick={async () => setPreview({ s, data: (await get(`/campaigns/segments/${s.id}/preview`)).data })}>Preview</Button></td></tr>
            ))}
          </tbody></table>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="New segment" footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={create.isPending} disabled={!v.name} onClick={() => create.mutate()}>Create</Button></>}>
        <div className="stack">
          <TextField label="Name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          <TextField as="select" label="Audience" value={v.entity_type} onChange={(e) => setV({ ...v, entity_type: e.target.value, field: e.target.value === 'contact' ? 'lead_source' : 'status' })} options={[{ value: 'contact', label: 'Contacts' }, { value: 'lead', label: 'Leads' }]} />
          <div className="grid cols-2">
            <TextField as="select" label="Where field" value={v.field} onChange={(e) => setV({ ...v, field: e.target.value })} options={fields} />
            <TextField label="Equals" value={v.value} onChange={(e) => setV({ ...v, value: e.target.value })} />
          </div>
        </div>
      </Modal>
      <Modal open={!!preview} onClose={() => setPreview(null)} title={`Preview: ${preview?.s.name}`}>
        <p><strong>{preview?.data.count}</strong> matching records</p>
        <ul>{preview?.data.sample.map((x) => <li key={x.id}>{x.name} <span className="subtle">{x.email}</span></li>)}</ul>
      </Modal>
    </>
  );
}

const LEAD_FIELDS = [['first_name', 'First name', 'text'], ['last_name', 'Last name', 'text'], ['email', 'Email', 'email'], ['phone', 'Phone', 'phone'], ['company', 'Company', 'text'], ['title', 'Job title', 'text'], ['website', 'Website', 'url'], ['country', 'Country', 'text'], ['description', 'Message', 'textarea']];

export function FormBuilder({ form, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const campaigns = useQuery({ queryKey: ['campaigns', 'options'], queryFn: () => get('/campaigns', { page_size: 100 }).then((r) => r.data) });
  const [v, setV] = useState(() => form || { name: 'Contact us', fields: [{ key: 'first_name', label: 'First name', type: 'text' }, { key: 'last_name', label: 'Last name', type: 'text', required: true }, { key: 'email', label: 'Email', type: 'email', required: true }], require_consent: true, consent_text: 'I agree to receive communications.', success_message: 'Thanks! We will be in touch.', campaign_id: null, allowed_origins: [] });
  const save = useMutation({
    mutationFn: () => {
      const body = { name: v.name, fields: v.fields, require_consent: v.require_consent, consent_text: v.consent_text || null, success_message: v.success_message || null, campaign_id: v.campaign_id || null, allowed_origins: v.allowed_origins || [], redirect_url: v.redirect_url || null };
      return form ? patch(`/forms/${form.id}`, body) : post('/forms', body);
    },
    onSuccess: () => { toast.success('Form saved'); qc.invalidateQueries({ queryKey: ['forms'] }); onClose(); }, onError: (e) => toast.error(e),
  });
  const setField = (i, k, val) => setV({ ...v, fields: v.fields.map((f, j) => (j === i ? { ...f, [k]: val } : f)) });
  const unused = LEAD_FIELDS.filter(([k]) => !v.fields.some((f) => f.key === k));
  return (
    <Modal open onClose={onClose} title={form ? 'Edit form' : 'New lead capture form'} size="lg" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>Save form</Button></>}>
      <div className="stack">
        <div className="grid cols-2">
          <TextField label="Form name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          <TextField as="select" label="Attribute leads to campaign" value={v.campaign_id || ''} placeholder="None" options={(campaigns.data || []).map((c) => ({ value: c.id, label: c.name }))} onChange={(e) => setV({ ...v, campaign_id: e.target.value || null })} />
        </div>
        <strong>Fields</strong>
        {v.fields.map((f, i) => (
          <div key={f.key} className="row">
            <span className="mono small" style={{ width: 110 }}>{f.key}</span>
            <input className="input grow" aria-label={`Label for ${f.key}`} value={f.label} onChange={(e) => setField(i, 'label', e.target.value)} />
            <Checkbox label="Required" checked={!!f.required} onChange={(e) => setField(i, 'required', e.target.checked)} />
            <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove ${f.key}`} onClick={() => setV({ ...v, fields: v.fields.filter((_, j) => j !== i) })} />
          </div>
        ))}
        {unused.length > 0 && <Select aria-label="Add field" value="" placeholder="+ Add field" options={unused.map(([k, l]) => ({ value: k, label: l }))} onChange={(e) => { const d = LEAD_FIELDS.find(([k]) => k === e.target.value); setV({ ...v, fields: [...v.fields, { key: d[0], label: d[1], type: d[2] }] }); }} />}
        <Checkbox label="Require consent checkbox" checked={!!v.require_consent} onChange={(e) => setV({ ...v, require_consent: e.target.checked })} />
        <TextField label="Consent text" value={v.consent_text || ''} onChange={(e) => setV({ ...v, consent_text: e.target.value })} />
        <TextField label="Success message" value={v.success_message || ''} onChange={(e) => setV({ ...v, success_message: e.target.value })} />
        <TextField label="Allowed embed origins (comma separated, optional)" value={(v.allowed_origins || []).join(', ')} onChange={(e) => setV({ ...v, allowed_origins: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} hint="When set, browser submissions from other sites are rejected." />
      </div>
    </Modal>
  );
}

function FormsList() {
  const { can } = useAuth();
  const toast = useToast();
  const forms = useQuery({ queryKey: ['forms'], queryFn: () => get('/forms').then((r) => r.data) });
  const [editing, setEditing] = useState(null);
  return (
    <>
      <PageHeader title="Lead capture forms" subtitle="Hosted or embedded forms that create leads with consent records." actions={can('forms:create') && <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>New form</Button>} />
      {!forms.data?.length ? <Card><EmptyState title="No forms yet" message="Create a form and share its link or embed it on your website." /></Card> : (
        <div className="grid cols-2">
          {forms.data.map((f) => (
            <Card key={f.id} title={f.name} actions={<Badge value={f.is_active ? 'active' : 'disabled'} />}>
              <div className="stack sm">
                <div className="small muted">{f.submission_count} submissions · {f.fields.length} fields</div>
                <div className="row tight">
                  <a href={f.hosted_url} target="_blank" rel="noopener noreferrer" className="btn sm">Open hosted form</a>
                  <Button size="sm" icon={Copy} onClick={() => { navigator.clipboard?.writeText(`POST ${f.embed_url}/submit  {"data": {...}, "consent": true}`); toast.info('Endpoint copied'); }}>Copy endpoint</Button>
                  {can('forms:update') && <Button size="sm" onClick={() => setEditing(f)}>Edit</Button>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && <FormBuilder form={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function Members({ campaign }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const members = useQuery({ queryKey: ['campaign-members', campaign.id], queryFn: () => get(`/campaigns/${campaign.id}/members`).then((r) => r) });
  const segments = useQuery({ queryKey: ['segments'], queryFn: () => get('/campaigns/segments').then((r) => r.data) });
  const [seg, setSeg] = useState('');
  const add = useMutation({ mutationFn: () => post(`/campaigns/${campaign.id}/members`, { segment_id: seg }), onSuccess: (r) => { toast.success(`${r.data.added} added, ${r.data.skipped} already members`); qc.invalidateQueries({ queryKey: ['campaign-members', campaign.id] }); }, onError: (e) => toast.error(e) });
  const remove = useMutation({ mutationFn: (mid) => del(`/campaigns/${campaign.id}/members/${mid}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign-members', campaign.id] }) });
  return (
    <div className="stack">
      {can('campaigns:update') && <div className="row"><Select aria-label="Segment" value={seg} onChange={(e) => setSeg(e.target.value)} placeholder="Add members from segment…" options={(segments.data || []).map((s) => ({ value: s.id, label: s.name }))} /><Button disabled={!seg} loading={add.isPending} onClick={() => add.mutate()}>Add</Button></div>}
      <table className="table"><tbody>
        {(members.data?.data || []).map((m) => (
          <tr key={m.id}>
            <td>{m.lead ? <Link to={`/leads/${m.lead.id}`}>{fullName(m.lead)}</Link> : m.contact ? <Link to={`/contacts/${m.contact.id}`}>{fullName(m.contact)}</Link> : '—'}</td>
            <td>{(m.lead || m.contact)?.email}</td><td><Badge value={m.status} /></td><td className="small subtle">{relative(m.created_at)}</td>
            <td>{can('campaigns:update') && <Button size="sm" variant="ghost" icon={Trash2} aria-label="Remove member" onClick={() => remove.mutate(m.id)} />}</td>
          </tr>
        ))}
      </tbody></table>
      {!members.data?.data?.length && <EmptyState title="No members yet" />}
    </div>
  );
}

export function CampaignDetailPage() {
  const { id } = useParams();
  const perf = useQuery({ queryKey: ['campaign-perf', id], queryFn: () => get(`/campaigns/${id}/performance`).then((r) => r.data) });
  const p = perf.data;
  return (
    <RecordPage entityType="campaign" id={id}
      headerExtra={(r) => <Badge value={r.status} />}
      tabs={[
        { value: 'performance', label: 'Performance', render: () => p && (
          <div className="grid kpis">
            <Kpi label="Leads" value={p.leads} sub={`${percent(p.conversion_rate, 1)} converted`} />
            <Kpi label="Opportunities" value={p.opportunities} sub={`${money(p.pipeline_amount, undefined, { compact: true })} open`} />
            <Kpi label="Won revenue" value={money(p.won_revenue, undefined, { compact: true })} />
            <Kpi label="ROI" value={p.roi === null ? '—' : percent(p.roi)} sub="(won − cost) / cost" />
          </div>
        ) },
        { value: 'members', label: 'Members', render: (r) => <Members campaign={r} /> },
      ]}
      details={(r) => (
        <Card title="Campaign">
          <DescriptionList items={[['Type', r.type], ['Dates', `${date(r.start_date)} – ${date(r.end_date)}`], ['Budget', money(r.budget, r.currency)], ['Actual cost', money(r.actual_cost, r.currency)], ['Expected revenue', money(r.expected_revenue, r.currency)], ['Source', r.source], ['Owner', r.owner?.name]]} />
          <div style={{ marginTop: 12 }}><Alert>Email blasts to campaign members are on the roadmap. Use workflows + templates for automated follow-ups today.</Alert></div>
        </Card>
      )} />
  );
}

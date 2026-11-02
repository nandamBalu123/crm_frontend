import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, Plug, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import { get, post, patch, del, API_ORIGIN } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Alert, Badge, Button, Card, Checkbox, ConfirmDialog, EmptyState, Modal, Skeleton, TextField } from '../../components/ui';
import { dateTime, relative, titleCase } from '../../utils/format';

function ConnectModal({ provider, connection, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const props = provider.config_schema?.properties || {};
  const [config, setConfig] = useState(() => ({ ...Object.fromEntries(Object.entries(props).map(([k, s]) => [k, s.default ?? ''])), ...(connection?.config || {}) }));
  const [secrets, setSecrets] = useState({});
  const [name, setName] = useState(connection?.name || provider.name);
  const [created, setCreated] = useState(null);
  const save = useMutation({
    mutationFn: () => {
      const cfg = Object.fromEntries(Object.entries(config).filter(([, v]) => v !== '' && v !== undefined).map(([k, v]) => [k, props[k]?.type === 'integer' || props[k]?.type === 'number' ? Number(v) : props[k]?.type === 'boolean' ? v === true || v === 'true' : v]));
      const sec = Object.fromEntries(Object.entries(secrets).filter(([, v]) => v));
      return connection ? patch(`/integrations/${connection.id}`, { name, config: cfg, ...(Object.keys(sec).length ? { secrets: sec } : {}) }) : post('/integrations', { provider: provider.key, name, config: cfg, secrets: sec });
    },
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['integrations'] }); if (r.data.signing_secret) setCreated(r.data); else { toast.success('Connection saved. Run a test to verify it.'); onClose(); } },
    onError: (e) => toast.error(e),
  });
  if (created) {
    return (
      <Modal open onClose={onClose} title="Inbound endpoint ready" footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
        <div className="stack">
          <Alert tone="warning">Copy the signing secret now — it will not be shown again.</Alert>
          <TextField label="Endpoint URL" value={created.inbound_url} readOnly />
          <TextField label="Signing secret" value={created.signing_secret} readOnly />
          <pre className="mono small card card-body" style={{ whiteSpace: 'pre-wrap' }}>{`POST ${created.inbound_url}\nX-CRM-Timestamp: <unix seconds>\nX-CRM-Event-Id: <unique id>\nX-CRM-Signature: v1=HMAC_SHA256(secret, "<timestamp>.<raw body>")`}</pre>
        </div>
      </Modal>
    );
  }
  return (
    <Modal open onClose={onClose} title={`${connection ? 'Configure' : 'Connect'} ${provider.name}`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
      <div className="stack">
        <p className="small muted">{provider.description}</p>
        {provider.auth === 'oauth2' && <Alert>After saving, use “Connect account” to sign in with {provider.name}.</Alert>}
        <TextField label="Connection name" value={name} onChange={(e) => setName(e.target.value)} />
        {Object.entries(props).map(([k, s]) => (
          s.type === 'boolean' ? <Checkbox key={k} label={titleCase(k)} checked={config[k] === true || config[k] === 'true'} onChange={(e) => setConfig({ ...config, [k]: e.target.checked })} />
            : s.enum ? <TextField key={k} as="select" label={titleCase(k)} value={config[k] ?? ''} options={s.enum} onChange={(e) => setConfig({ ...config, [k]: e.target.value })} />
              : s.type === 'object' ? null
                : <TextField key={k} label={titleCase(k)} type={s.type === 'integer' || s.type === 'number' ? 'number' : 'text'} value={config[k] ?? ''} onChange={(e) => setConfig({ ...config, [k]: e.target.value })} required={(provider.config_schema.required || []).includes(k)} />
        ))}
        {provider.secret_fields.filter((f) => f !== 'signing_secret').map((k) => (
          <TextField key={k} label={titleCase(k)} type="password" autoComplete="off" value={secrets[k] || ''} onChange={(e) => setSecrets({ ...secrets, [k]: e.target.value })} hint={connection?.secrets_set?.includes(k) ? 'Stored encrypted. Leave blank to keep the current value.' : 'Stored encrypted; never shown again.'} />
        ))}
      </div>
    </Modal>
  );
}

export function IntegrationsSettings() {
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [sp] = useSearchParams();
  const providers = useQuery({ queryKey: ['integration-providers'], queryFn: () => get('/integrations/providers').then((r) => r.data) });
  const conns = useQuery({ queryKey: ['integrations'], queryFn: () => get('/integrations').then((r) => r.data) });
  const [modal, setModal] = useState(null);
  const [removing, setRemoving] = useState(null);
  useEffect(() => { if (sp.get('oauth') === 'connected') toast.success('Account connected'); if (sp.get('oauth') === 'error') toast.error('The provider did not complete the connection'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const test = useMutation({ mutationFn: (id) => post(`/integrations/${id}/test`).then((r) => r.data), onSuccess: (r) => { (r.ok ? toast.success : toast.error)(r.message); qc.invalidateQueries({ queryKey: ['integrations'] }); }, onError: (e) => toast.error(e) });
  const oauth = useMutation({ mutationFn: (id) => post(`/integrations/${id}/oauth/start`).then((r) => r.data), onSuccess: (r) => window.location.assign(r.authorize_url), onError: (e) => toast.error(e) });
  const remove = useMutation({ mutationFn: (id) => del(`/integrations/${id}`), onSuccess: () => { setRemoving(null); qc.invalidateQueries({ queryKey: ['integrations'] }); } });
  const toggle = useMutation({ mutationFn: (c) => patch(`/integrations/${c.id}`, { status: c.status === 'disabled' ? 'enabled' : 'disabled' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }) });
  if (!providers.data) return <Skeleton />;
  const byCategory = {};
  for (const p of providers.data) (byCategory[p.category] = byCategory[p.category] || []).push(p);
  const connsFor = (key) => (conns.data || []).filter((c) => c.provider === key);
  return (
    <div className="stack">
      <Alert>Connections are verified with a live call to the provider. Nothing is simulated: without valid credentials a connection shows “configuration required”.</Alert>
      {Object.entries(byCategory).map(([cat, list]) => (
        <Card key={cat} title={titleCase(cat)}>
          <div className="grid cols-2">
            {list.map((p) => (
              <div key={p.key} className="card card-body stack sm">
                <div className="row between"><strong className="row tight"><Plug size={16} />{p.name}</strong>{!p.platform_ready ? <Badge tone="warning">Platform setup required</Badge> : connsFor(p.key).length ? null : <Badge value="not_configured">Not connected</Badge>}</div>
                <span className="small muted">{p.description}</span>
                {!p.platform_ready && <span className="small subtle">Your platform administrator must set {p.env_vars.join(', ')}.</span>}
                {connsFor(p.key).map((c) => (
                  <div key={c.id} className="stack sm" style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                    <div className="row between"><span>{c.name}</span><Badge value={c.status} /></div>
                    {c.last_error && <span className="small error">{c.last_error}</span>}
                    {c.last_tested_at && <span className="small subtle">Tested {relative(c.last_tested_at)}</span>}
                    {can('integrations:manage') && <div className="row tight">
                      {p.auth === 'oauth2' && <Button size="sm" variant="primary" onClick={() => oauth.mutate(c.id)}>{c.oauth_connected ? 'Reconnect account' : 'Connect account'}</Button>}
                      <Button size="sm" icon={RefreshCw} loading={test.isPending && test.variables === c.id} onClick={() => test.mutate(c.id)}>Test</Button>
                      <Button size="sm" onClick={() => setModal({ provider: p, connection: c })}>Configure</Button>
                      <Button size="sm" variant="ghost" onClick={() => toggle.mutate(c)}>{c.status === 'disabled' ? 'Enable' : 'Disable'}</Button>
                      <Button size="sm" variant="ghost" icon={Trash2} aria-label="Remove connection" onClick={() => setRemoving(c)} />
                    </div>}
                  </div>
                ))}
                {can('integrations:manage') && p.platform_ready && <Button size="sm" icon={Plus} onClick={() => setModal({ provider: p })}>{connsFor(p.key).length ? 'Add another' : 'Connect'}</Button>}
              </div>
            ))}
          </div>
        </Card>
      ))}
      <Card title="REST API"><span className="small">Use API keys (Settings → API keys) with the versioned REST API. The OpenAPI document is served at <code>/api/v1/openapi.json</code>.</span></Card>
      {modal && <ConnectModal provider={modal.provider} connection={modal.connection} onClose={() => setModal(null)} />}
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} danger title="Remove connection?" message="Stored credentials are deleted." confirmLabel="Remove" onConfirm={() => remove.mutate(removing.id)} />
    </div>
  );
}

export function ApiKeysSettings() {
  const qc = useQueryClient();
  const toast = useToast();
  const { me } = useAuth();
  const keys = useQuery({ queryKey: ['api-keys'], queryFn: () => get('/api-keys').then((r) => r.data) });
  const catalog = useQuery({ queryKey: ['permission-catalog'], queryFn: () => get('/roles/permissions').then((r) => r.data).catch(() => []) });
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: '', scopes: {}, expires_in_days: 365 });
  const [shown, setShown] = useState(null);
  const create = useMutation({ mutationFn: () => post('/api-keys', { name: v.name, scopes: v.scopes, expires_in_days: Number(v.expires_in_days) || undefined }), onSuccess: (r) => { setShown(r.data.key); setOpen(false); qc.invalidateQueries({ queryKey: ['api-keys'] }); }, onError: (e) => toast.error(e) });
  const revoke = useMutation({ mutationFn: (id) => del(`/api-keys/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }) });
  const mine = Object.keys(me.permissions || {});
  const options = (catalog.data || []).flatMap((g) => g.permissions).filter((p) => mine.includes(p.key) && !['api_keys', 'roles', 'billing'].includes(p.module));
  const planBlocked = !me.plan?.features?.includes('api') && me.plan?.features?.length > 0;
  return (
    <Card title="API keys" actions={<Button variant="primary" icon={KeyRound} disabled={planBlocked} onClick={() => setOpen(true)}>Create key</Button>} flush>
      {planBlocked && <div className="card-body"><Alert tone="warning">API access is not included in the {me.plan.name} plan. Upgrade in Settings → Billing to create API keys.</Alert></div>}
      {!keys.data?.length ? <EmptyState title="No API keys" /> : (
        <table className="table"><thead><tr><th>Name</th><th>Key</th><th>Scopes</th><th>Last used</th><th>Expires</th><th>Status</th><th /></tr></thead>
          <tbody>{keys.data.map((k) => <tr key={k.id}><td><strong>{k.name}</strong></td><td className="mono">{k.display}</td><td className="small">{Object.keys(k.scopes).length} permissions</td><td className="small">{relative(k.last_used_at)}</td><td className="small">{k.expires_at ? dateTime(k.expires_at) : 'Never'}</td><td><Badge value={k.revoked_at ? 'disabled' : 'active'}>{k.revoked_at ? 'Revoked' : 'Active'}</Badge></td><td>{!k.revoked_at && <Button size="sm" variant="ghost" onClick={() => revoke.mutate(k.id)}>Revoke</Button>}</td></tr>)}</tbody></table>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Create API key" size="lg" footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" disabled={!v.name || !Object.keys(v.scopes).length} loading={create.isPending} onClick={() => create.mutate()}>Create</Button></>}>
        <div className="stack">
          <div className="grid cols-2"><TextField label="Name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /><TextField label="Expires in (days)" type="number" value={v.expires_in_days} onChange={(e) => setV({ ...v, expires_in_days: e.target.value })} /></div>
          <span className="label">Scopes (limited to your own permissions)</span>
          {!Object.keys(v.scopes).length && <span className="small warning-text">Select at least one scope to create the key.</span>}
          <div className="grid cols-3" style={{ maxHeight: 280, overflowY: 'auto' }}>{options.map((p) => <Checkbox key={p.key} label={p.key} checked={!!v.scopes[p.key]} onChange={(e) => { const s = { ...v.scopes }; if (e.target.checked) s[p.key] = me.permissions[p.key]; else delete s[p.key]; setV({ ...v, scopes: s }); }} />)}</div>
        </div>
      </Modal>
      <Modal open={!!shown} onClose={() => setShown(null)} title="Your new API key" footer={<Button variant="primary" onClick={() => setShown(null)}>I have stored it</Button>}>
        <div className="stack"><Alert tone="warning">This key is shown once. Store it in a secret manager.</Alert><TextField label="API key" value={shown || ''} readOnly /><Button icon={Copy} onClick={() => navigator.clipboard?.writeText(shown)}>Copy</Button><pre className="mono small">{`curl -H "Authorization: Bearer ${shown?.slice(0, 18)}…" ${API_ORIGIN || window.location.origin}/api/v1/leads`}</pre></div>
      </Modal>
    </Card>
  );
}

export function WebhooksSettings() {
  const qc = useQueryClient();
  const toast = useToast();
  const list = useQuery({ queryKey: ['webhooks'], queryFn: () => get('/webhooks').then((r) => r.data) });
  const types = useQuery({ queryKey: ['webhook-types'], queryFn: () => get('/webhooks/event-types').then((r) => r.data) });
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ url: '', events: [] });
  const [secret, setSecret] = useState(null);
  const [sel, setSel] = useState(null);
  const deliveries = useQuery({ queryKey: ['webhook-deliveries', sel], queryFn: () => get(`/webhooks/${sel}/deliveries`).then((r) => r.data), enabled: !!sel });
  const create = useMutation({ mutationFn: () => post('/webhooks', v), onSuccess: (r) => { setSecret(r.data.secret); setOpen(false); qc.invalidateQueries({ queryKey: ['webhooks'] }); }, onError: (e) => toast.error(e) });
  const testIt = useMutation({ mutationFn: (id) => post(`/webhooks/${id}/test`).then((r) => r.data), onSuccess: (d) => { (d.status === 'succeeded' ? toast.success : toast.error)(`Ping ${d.status}${d.response_status ? ` (HTTP ${d.response_status})` : ''}${d.error ? `: ${d.error}` : ''}`); qc.invalidateQueries({ queryKey: ['webhook-deliveries'] }); } });
  const update = useMutation({ mutationFn: ({ id, ...body }) => patch(`/webhooks/${id}`, body), onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }) });
  const remove = useMutation({ mutationFn: (id) => del(`/webhooks/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }) });
  const redeliver = useMutation({ mutationFn: (id) => post(`/webhooks/deliveries/${id}/redeliver`), onSuccess: () => toast.info('Redelivery queued') });
  return (
    <div className="stack">
      <Card title="Webhook endpoints" actions={<Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>Add endpoint</Button>} flush>
        {!list.data?.length ? <EmptyState title="No endpoints" message="Receive signed JSON events when CRM data changes." /> : (
          <table className="table"><tbody>{list.data.map((w) => (
            <tr key={w.id}><td><strong className="mono">{w.url}</strong><div className="small subtle">{w.events.join(', ')}</div>{w.disabled_reason && <div className="small error">{w.disabled_reason}</div>}</td><td><Badge value={w.is_active ? 'active' : 'disabled'} /></td>
              <td className="right nowrap"><Button size="sm" icon={Send} onClick={() => testIt.mutate(w.id)}>Ping</Button><Button size="sm" onClick={() => setSel(w.id)}>Deliveries</Button><Button size="sm" variant="ghost" onClick={() => update.mutate({ id: w.id, is_active: !w.is_active })}>{w.is_active ? 'Disable' : 'Enable'}</Button><Button size="sm" variant="ghost" icon={Trash2} aria-label="Delete endpoint" onClick={() => remove.mutate(w.id)} /></td></tr>
          ))}</tbody></table>
        )}
      </Card>
      {sel && <Card title="Recent deliveries" flush>
        <table className="table"><thead><tr><th>When</th><th>Event</th><th>Status</th><th>HTTP</th><th>Attempts</th><th>Duration</th><th /></tr></thead>
          <tbody>{(deliveries.data || []).map((d) => <tr key={d.id}><td className="small">{dateTime(d.created_at)}</td><td>{d.event_type}</td><td><Badge value={d.status} /></td><td>{d.response_status || '—'}</td><td>{d.attempts}</td><td>{d.duration_ms ? `${d.duration_ms} ms` : '—'}</td><td>{d.status !== 'succeeded' && <Button size="sm" onClick={() => redeliver.mutate(d.id)}>Retry</Button>}</td></tr>)}</tbody></table>
      </Card>}
      <Card title="Verifying signatures"><pre className="mono small" style={{ whiteSpace: 'pre-wrap' }}>{`X-CRM-Signature: t=<unix>,v1=<hex>\nexpected = HMAC_SHA256(secret, "<t>.<raw request body>")\nReject if |now - t| > 300s. De-duplicate with X-CRM-Event-Id.`}</pre></Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Add webhook endpoint" footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" disabled={!v.url || !v.events.length} loading={create.isPending} onClick={() => create.mutate()}>Add</Button></>}>
        <div className="stack">
          <TextField label="HTTPS URL" value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} hint="Private and internal network addresses are rejected." />
          <Checkbox label="All events" checked={v.events.includes('*')} onChange={(e) => setV({ ...v, events: e.target.checked ? ['*'] : [] })} />
          {!v.events.length && <span className="small warning-text">Select at least one event (or All events).</span>}
          {!v.events.includes('*') && <div className="grid cols-2">{(types.data || []).map((t) => <Checkbox key={t} label={t} checked={v.events.includes(t)} onChange={(e) => setV({ ...v, events: e.target.checked ? [...v.events, t] : v.events.filter((x) => x !== t) })} />)}</div>}
        </div>
      </Modal>
      <Modal open={!!secret} onClose={() => setSecret(null)} title="Signing secret" footer={<Button variant="primary" onClick={() => setSecret(null)}>Done</Button>}>
        <Alert tone="warning">Shown once. Use it to verify the X-CRM-Signature header.</Alert>
        <TextField label="Secret" value={secret || ''} readOnly />
      </Modal>
    </div>
  );
}

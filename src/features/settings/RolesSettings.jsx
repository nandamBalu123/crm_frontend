import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { get, post, patch, del } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Alert, Badge, Button, Card, ConfirmDialog, Modal, Skeleton, Tabs, TextField } from '../../components/ui';
import { titleCase } from '../../utils/format';

const ACTIONS = ['read', 'create', 'update', 'delete', 'import', 'export', 'assign', 'share', 'convert', 'merge', 'approve', 'manage'];

function Matrix({ catalog, value, onChange, editable }) {
  const toggle = (p, on) => {
    const next = { ...value };
    if (on) next[p.key] = 'all';
    else delete next[p.key];
    onChange(next);
  };
  const setModule = (perms, on) => {
    const next = { ...value };
    for (const p of perms) { if (on) next[p.key] = next[p.key] || 'all'; else delete next[p.key]; }
    onChange(next);
  };
  return (
    <div className="table-wrap">
      <table className="table matrix">
        <thead><tr><th>Module</th><th>All</th>{ACTIONS.map((a) => <th key={a}>{titleCase(a)}</th>)}</tr></thead>
        <tbody>
          {catalog.map(({ module, permissions }) => {
            const allOn = permissions.every((p) => value[p.key]);
            return (
              <tr key={module}>
                <td><strong>{titleCase(module)}</strong></td>
                <td><input type="checkbox" aria-label={`All ${module} permissions`} checked={allOn} disabled={!editable} onChange={(e) => setModule(permissions, e.target.checked)} /></td>
                {ACTIONS.map((a) => {
                  const p = permissions.find((x) => x.action === a);
                  if (!p) return <td key={a} className="subtle">·</td>;
                  return (
                    <td key={a}>
                      <div className="stack sm" style={{ alignItems: 'center', gap: 2 }}>
                        <input type="checkbox" aria-label={p.description} checked={!!value[p.key]} disabled={!editable} onChange={(e) => toggle(p, e.target.checked)} />
                        {p.supports_scope && value[p.key] && (
                          <select className="scope-select" aria-label={`Record scope for ${p.description}`} value={value[p.key]} disabled={!editable} onChange={(e) => onChange({ ...value, [p.key]: e.target.value })}>
                            <option value="own">Own</option><option value="team">Team</option><option value="all">All</option>
                          </select>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FieldPermissions({ value, onChange, editable }) {
  const fields = useQuery({ queryKey: ['role-fields'], queryFn: () => get('/roles/fields').then((r) => r.data) });
  const get_ = (entity, key) => value.find((f) => f.entity_type === entity && f.field_key === key)?.access || 'write';
  const set = (entity, key, access) => {
    const rest = value.filter((f) => !(f.entity_type === entity && f.field_key === key));
    onChange(access === 'write' ? rest : [...rest, { entity_type: entity, field_key: key, access }]);
  };
  if (!fields.data) return <Skeleton />;
  return (
    <div className="stack">
      <Alert>Restrict sensitive fields for this role. If a user has several roles, the least restrictive access applies.</Alert>
      {Object.entries(fields.data).map(([entity, list]) => list.length > 0 && (
        <Card key={entity} title={titleCase(entity)} flush>
          <table className="table"><tbody>{list.map((f) => (
            <tr key={f.key}><td>{titleCase(f.label)} {f.custom && <Badge>custom</Badge>}</td>
              <td className="right"><select className="scope-select" aria-label={`Access to ${f.label}`} disabled={!editable} value={get_(entity, f.key)} onChange={(e) => set(entity, f.key, e.target.value)}><option value="write">Read & write</option><option value="read">Read only</option><option value="hidden">Hidden</option></select></td></tr>
          ))}</tbody></table>
        </Card>
      ))}
    </div>
  );
}

export function RolesSettings() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => get('/roles').then((r) => r.data) });
  const catalog = useQuery({ queryKey: ['permission-catalog'], queryFn: () => get('/roles/permissions').then((r) => r.data) });
  const [selectedId, setSelectedId] = useState(null);
  const role = useQuery({ queryKey: ['roles', selectedId], queryFn: () => get(`/roles/${selectedId}`).then((r) => r.data), enabled: !!selectedId });
  const [perms, setPerms] = useState({});
  const [fieldPerms, setFieldPerms] = useState([]);
  const [tab, setTab] = useState('permissions');
  const [creating, setCreating] = useState(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => { if (!selectedId && roles.data?.length) setSelectedId(roles.data.find((r) => r.key === 'sales_rep')?.id || roles.data[0].id); }, [roles.data, selectedId]);
  useEffect(() => { if (role.data) { setPerms(role.data.permissions); setFieldPerms(role.data.field_permissions); } }, [role.data]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['roles'] }); qc.invalidateQueries({ queryKey: ['me'] }); };
  const save = useMutation({ mutationFn: () => patch(`/roles/${selectedId}`, { permissions: perms, field_permissions: fieldPerms }), onSuccess: () => { toast.success('Role saved'); refresh(); }, onError: (e) => toast.error(e) });
  const toggleActive = useMutation({ mutationFn: (is_active) => patch(`/roles/${selectedId}`, { is_active }), onSuccess: refresh, onError: (e) => toast.error(e) });
  const create = useMutation({
    mutationFn: () => (creating.clone ? post(`/roles/${creating.clone}/clone`, { name: creating.name }) : post('/roles', { name: creating.name, description: creating.description || undefined, permissions: {} })),
    onSuccess: (r) => { toast.success('Role created'); setCreating(null); refresh(); setSelectedId(r.data.id); }, onError: (e) => toast.error(e),
  });
  const remove = useMutation({ mutationFn: () => del(`/roles/${selectedId}`), onSuccess: () => { setDeleting(false); setSelectedId(null); refresh(); }, onError: (e) => { toast.error(e); setDeleting(false); } });
  const dirty = useMemo(() => role.data && (JSON.stringify(perms) !== JSON.stringify(role.data.permissions) || JSON.stringify(fieldPerms) !== JSON.stringify(role.data.field_permissions)), [perms, fieldPerms, role.data]);
  if (!roles.data || !catalog.data) return <Skeleton />;
  const editable = can('roles:manage') && role.data && !role.data.is_protected;
  return (
    <div className="split" style={{ gridTemplateColumns: '240px minmax(0, 1fr)' }}>
      <Card title="Roles" actions={can('roles:manage') && <Button size="sm" icon={Plus} aria-label="New role" onClick={() => setCreating({ name: '' })} />} flush>
        <div className="stack sm" style={{ padding: 8 }}>
          {roles.data.map((r) => (
            <button key={r.id} type="button" className={`nav-link ${r.id === selectedId ? 'active' : ''}`} style={{ border: 0, width: '100%', justifyContent: 'space-between', background: r.id === selectedId ? undefined : 'none' }} onClick={() => setSelectedId(r.id)}>
              <span className="truncate">{r.name}</span><span className="small subtle">{r.member_count}{!r.is_active && ' · off'}</span>
            </button>
          ))}
        </div>
      </Card>
      {!role.data ? <Skeleton /> : (
        <Card title={<span className="row tight"><h3>{role.data.name}</h3>{role.data.is_system && <Badge>System</Badge>}{role.data.is_protected && <Badge tone="brand">Protected</Badge>}{!role.data.is_active && <Badge tone="warning">Disabled</Badge>}</span>}
          actions={can('roles:manage') && <>
            <Button size="sm" icon={Copy} onClick={() => setCreating({ name: `${role.data.name} (copy)`, clone: role.data.id })}>Clone</Button>
            {!role.data.is_protected && <Button size="sm" onClick={() => toggleActive.mutate(!role.data.is_active)}>{role.data.is_active ? 'Disable' : 'Enable'}</Button>}
            {!role.data.is_system && <Button size="sm" variant="ghost" icon={Trash2} aria-label="Delete role" onClick={() => setDeleting(true)} />}
            {editable && <Button size="sm" variant="primary" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button>}
          </>}>
          <div className="stack">
            <span className="small muted">{role.data.description} · {role.data.member_count} member(s)</span>
            {role.data.is_protected && <Alert>The owner role always has every permission and cannot be edited.</Alert>}
            <Tabs value={tab} onChange={setTab} tabs={[{ value: 'permissions', label: 'Permission matrix' }, { value: 'fields', label: 'Field permissions' }]} />
            {tab === 'permissions' ? <Matrix catalog={catalog.data} value={perms} onChange={setPerms} editable={editable} /> : <FieldPermissions value={fieldPerms} onChange={setFieldPerms} editable={editable} />}
            <span className="small subtle">Scopes: Own = records the user owns · Team = records owned by teammates · All = every record in the workspace. You can only grant permissions you hold.</span>
          </div>
        </Card>
      )}
      <Modal open={!!creating} onClose={() => setCreating(null)} title={creating?.clone ? 'Clone role' : 'New role'} footer={<><Button onClick={() => setCreating(null)}>Cancel</Button><Button variant="primary" disabled={!creating?.name} loading={create.isPending} onClick={() => create.mutate()}>Create</Button></>}>
        {creating && <div className="stack"><TextField label="Role name" value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.target.value })} />{!creating.clone && <TextField label="Description" value={creating.description || ''} onChange={(e) => setCreating({ ...creating, description: e.target.value })} />}</div>}
      </Modal>
      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} danger title="Delete role?" message="Roles that are still assigned cannot be deleted." confirmLabel="Delete" loading={remove.isPending} onConfirm={() => remove.mutate()} />
    </div>
  );
}

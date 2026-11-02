import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import { get, post, patch, del } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Avatar, Badge, Button, Card, Checkbox, ConfirmDialog, Drawer, EmptyState, Modal, Skeleton, TextField } from '../../components/ui';
import { fullName, relative } from '../../utils/format';

const useRoles = () => useQuery({ queryKey: ['roles'], queryFn: () => get('/roles').then((r) => r.data) });
const useTeams = () => useQuery({ queryKey: ['teams'], queryFn: () => get('/teams').then((r) => r.data) });

function MemberDrawer({ member, onClose }) {
  const roles = useRoles();
  const teams = useTeams();
  const qc = useQueryClient();
  const toast = useToast();
  const { me } = useAuth();
  const [roleIds, setRoleIds] = useState(member.roles.filter((r) => r.key !== 'owner').map((r) => r.id));
  const [teamIds, setTeamIds] = useState(member.team_ids);
  const [title, setTitle] = useState(member.title || '');
  const [transfer, setTransfer] = useState(false);
  const save = useMutation({
    mutationFn: (extra = {}) => patch(`/users/${member.id}`, { ...(member.user_id !== me.user.id && !member.is_owner ? { role_ids: roleIds } : {}), team_ids: teamIds, title: title || null, ...extra }),
    onSuccess: () => { toast.success('User updated'); qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['members'] }); onClose(); },
    onError: (e) => toast.error(e),
  });
  const doTransfer = useMutation({ mutationFn: () => post(`/users/${member.id}/transfer-ownership`), onSuccess: () => { toast.success('Ownership transferred'); qc.invalidateQueries(); onClose(); }, onError: (e) => toast.error(e) });
  const self = member.user_id === me.user.id;
  return (
    <Drawer open onClose={onClose} title={fullName(member.user)}
      footer={<>
        {!self && !member.is_owner && <Button variant={member.status === 'active' ? 'danger' : 'default'} onClick={() => save.mutate({ status: member.status === 'active' ? 'disabled' : 'active' })}>{member.status === 'active' ? 'Disable user' : 'Re-activate'}</Button>}
        <div className="grow" /><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
      </>}>
      <div className="stack">
        <div className="row"><Avatar name={fullName(member.user)} size="lg" /><div><strong>{member.user.email}</strong><div className="small subtle">Joined {relative(member.joined_at)} · MFA {member.user.mfa_enabled ? 'on' : 'off'}</div></div></div>
        <TextField label="Job title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="field"><span className="label">Roles</span>
          {member.is_owner && <Badge tone="brand">Workspace owner</Badge>}
          {self && <span className="small subtle">You cannot change your own roles.</span>}
          {(roles.data || []).filter((r) => r.key !== 'owner').map((r) => <Checkbox key={r.id} label={`${r.name}${r.is_active ? '' : ' (disabled)'}`} disabled={self || member.is_owner || !r.is_active} checked={roleIds.includes(r.id)} onChange={(e) => setRoleIds(e.target.checked ? [...roleIds, r.id] : roleIds.filter((x) => x !== r.id))} />)}
        </div>
        <div className="field"><span className="label">Teams</span>{(teams.data || []).map((t) => <Checkbox key={t.id} label={t.name} checked={teamIds.includes(t.id)} onChange={(e) => setTeamIds(e.target.checked ? [...teamIds, t.id] : teamIds.filter((x) => x !== t.id))} />)}{!teams.data?.length && <span className="small subtle">No teams yet.</span>}</div>
        {me.membership.is_owner && !self && member.status === 'active' && <Button onClick={() => setTransfer(true)}>Transfer workspace ownership…</Button>}
      </div>
      <ConfirmDialog open={transfer} onClose={() => setTransfer(false)} danger title="Transfer ownership?" message={`${fullName(member.user)} becomes the owner. You will become an administrator.`} confirmLabel="Transfer" loading={doTransfer.isPending} onConfirm={() => doTransfer.mutate()} />
    </Drawer>
  );
}

export function UsersSettings() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const users = useQuery({ queryKey: ['users'], queryFn: () => get('/users').then((r) => r.data) });
  const invites = useQuery({ queryKey: ['invitations'], queryFn: () => get('/invitations').then((r) => r.data), enabled: can('users:manage') });
  const roles = useRoles();
  const [selected, setSelected] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [inv, setInv] = useState({ email: '', role_ids: [] });
  const invite = useMutation({ mutationFn: () => post('/invitations', inv), onSuccess: () => { toast.success(`Invitation sent to ${inv.email}`); setInviting(false); setInv({ email: '', role_ids: [] }); qc.invalidateQueries({ queryKey: ['invitations'] }); }, onError: (e) => toast.error(e) });
  const revoke = useMutation({ mutationFn: (id) => del(`/invitations/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['invitations'] }) });
  return (
    <>
      <Card title="Users" actions={can('users:manage') && <Button variant="primary" icon={UserPlus} onClick={() => setInviting(true)}>Invite user</Button>} flush>
        {users.isLoading ? <div className="card-body"><Skeleton /></div> : (
          <table className="table"><thead><tr><th>User</th><th>Roles</th><th>Status</th><th>MFA</th><th>Last active</th></tr></thead>
            <tbody>{(users.data || []).map((m) => (
              <tr key={m.id} className={can('users:manage') ? 'clickable' : ''} onClick={() => can('users:manage') && setSelected(m)}>
                <td><span className="row tight"><Avatar name={fullName(m.user)} /><span><strong>{fullName(m.user)}</strong><div className="small subtle">{m.user.email}</div></span></span></td>
                <td>{m.roles.map((r) => <Badge key={r.id} tone={r.key === 'owner' ? 'brand' : undefined}>{r.name}</Badge>)}</td>
                <td><Badge value={m.status} /></td><td>{m.user.mfa_enabled ? <Badge tone="success">On</Badge> : <Badge>Off</Badge>}</td><td className="small">{relative(m.last_active_at)}</td>
              </tr>
            ))}</tbody></table>
        )}
      </Card>
      {invites.data?.length > 0 && (
        <Card title="Pending invitations" flush>
          <table className="table"><tbody>{invites.data.map((i) => <tr key={i.id}><td>{i.email}</td><td className="small subtle">expires {relative(i.expires_at)}</td><td className="right"><Button size="sm" variant="ghost" icon={Trash2} aria-label={`Revoke invitation for ${i.email}`} onClick={() => revoke.mutate(i.id)} /></td></tr>)}</tbody></table>
        </Card>
      )}
      {selected && <MemberDrawer member={selected} onClose={() => setSelected(null)} />}
      <Modal open={inviting} onClose={() => setInviting(false)} title="Invite a user" footer={<><Button onClick={() => setInviting(false)}>Cancel</Button><Button variant="primary" disabled={!inv.email || !inv.role_ids.length} loading={invite.isPending} onClick={() => invite.mutate()}>Send invitation</Button></>}>
        <div className="stack">
          <TextField label="Email" type="email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} required />
          <div className="field"><span className="label">Roles</span>{(roles.data || []).filter((r) => r.key !== 'owner' && r.is_active).map((r) => <Checkbox key={r.id} label={<>{r.name} <span className="small subtle">— {r.description}</span></>} checked={inv.role_ids.includes(r.id)} onChange={(e) => setInv({ ...inv, role_ids: e.target.checked ? [...inv.role_ids, r.id] : inv.role_ids.filter((x) => x !== r.id) })} />)}</div>
          {!inv.role_ids.length && <span className="small warning-text">Select at least one role to send the invitation.</span>}
          <span className="small subtle">You can only grant roles whose permissions you hold yourself.</span>
        </div>
      </Modal>
    </>
  );
}

export function TeamsSettings() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const teams = useTeams();
  const users = useQuery({ queryKey: ['users'], queryFn: () => get('/users', { status: 'active' }).then((r) => r.data) });
  const [editing, setEditing] = useState(null);
  const save = useMutation({
    mutationFn: (t) => (t.id ? patch(`/teams/${t.id}`, { name: t.name, description: t.description || null, manager_user_id: t.manager_user_id || null, member_user_ids: t.member_user_ids }) : post('/teams', { name: t.name, description: t.description || null, manager_user_id: t.manager_user_id || null, member_user_ids: t.member_user_ids })),
    onSuccess: () => { toast.success('Team saved'); setEditing(null); qc.invalidateQueries({ queryKey: ['teams'] }); }, onError: (e) => toast.error(e),
  });
  const remove = useMutation({ mutationFn: (id) => del(`/teams/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }) });
  const name = (id) => fullName((users.data || []).find((u) => u.user_id === id)?.user);
  return (
    <Card title="Teams" actions={can('users:manage') && <Button variant="primary" icon={Plus} onClick={() => setEditing({ name: '', member_user_ids: [] })}>New team</Button>} flush>
      <p className="small subtle card-body" style={{ margin: 0 }}>Teams power the “team” record scope: members with team scope see records owned by their teammates.</p>
      {!teams.data?.length ? <EmptyState title="No teams" /> : (
        <table className="table"><tbody>{teams.data.map((t) => (
          <tr key={t.id}><td><strong>{t.name}</strong><div className="small subtle">{t.description}</div></td><td>{t.manager_user_id && `Manager: ${name(t.manager_user_id)}`}</td><td>{t.member_user_ids.length} members</td>
            <td className="right">{can('users:manage') && <><Button size="sm" onClick={() => setEditing(t)}>Edit</Button><Button size="sm" variant="ghost" icon={Trash2} aria-label={`Delete ${t.name}`} onClick={() => remove.mutate(t.id)} /></>}</td></tr>
        ))}</tbody></table>
      )}
      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? 'Edit team' : 'New team'} footer={<><Button onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => save.mutate(editing)}>Save</Button></>}>
          <div className="stack">
            <TextField label="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <TextField label="Description" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            <TextField as="select" label="Manager" value={editing.manager_user_id || ''} placeholder="None" options={(users.data || []).map((u) => ({ value: u.user_id, label: fullName(u.user) }))} onChange={(e) => setEditing({ ...editing, manager_user_id: e.target.value })} />
            <div className="field"><span className="label">Members</span>{(users.data || []).map((u) => <Checkbox key={u.user_id} label={fullName(u.user)} checked={editing.member_user_ids.includes(u.user_id)} onChange={(e) => setEditing({ ...editing, member_user_ids: e.target.checked ? [...editing.member_user_ids, u.user_id] : editing.member_user_ids.filter((x) => x !== u.user_id) })} />)}</div>
          </div>
        </Modal>
      )}
    </Card>
  );
}

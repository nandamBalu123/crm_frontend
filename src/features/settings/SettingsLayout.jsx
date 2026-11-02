import { Navigate, NavLink, Outlet } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/ui';

export const SETTINGS_NAV = [
  { group: 'Workspace', items: [
    { to: 'general', label: 'General', perm: 'settings:read' }, { to: 'branding', label: 'Branding', perm: 'settings:read' },
    { to: 'security', label: 'Security', perm: 'settings:read' }, { to: 'billing', label: 'Plan & usage', perm: 'billing:read' },
  ] },
  { group: 'People', items: [{ to: 'users', label: 'Users', perm: 'users:read' }, { to: 'teams', label: 'Teams', perm: 'users:read' }, { to: 'roles', label: 'Roles & permissions', perm: 'roles:read' }] },
  { group: 'Customise', items: [
    { to: 'custom-fields', label: 'Custom fields', perm: 'custom_fields:manage' }, { to: 'pipelines', label: 'Pipelines', perm: 'settings:manage' },
    { to: 'workflows', label: 'Workflows', perm: 'workflows:read' }, { to: 'templates', label: 'Email templates', perm: 'communications:read' }, { to: 'support', label: 'Support & SLA', perm: 'tickets:read' },
  ] },
  { group: 'Connect', items: [{ to: 'integrations', label: 'Integrations', perm: 'integrations:read' }, { to: 'api-keys', label: 'API keys', perm: 'api_keys:manage' }, { to: 'webhooks', label: 'Webhooks', perm: 'webhooks:manage' }] },
  { group: 'Compliance', items: [{ to: 'audit', label: 'Audit log', perm: 'audit:read' }] },
];

export function SettingsLayout() {
  const { can } = useAuth();
  return (
    <>
      <PageHeader title="Settings" />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings">
          {SETTINGS_NAV.map((g) => {
            const items = g.items.filter((i) => can(i.perm));
            if (!items.length) return null;
            return (
              <div key={g.group} className="stack sm" style={{ gap: 2, marginBottom: 12 }}>
                <div className="nav-group-label">{g.group}</div>
                {items.map((i) => <NavLink key={i.to} to={`/settings/${i.to}`} className={({ isActive }) => (isActive ? 'active' : '')}>{i.label}</NavLink>)}
              </div>
            );
          })}
        </nav>
        <div className="stack" style={{ minWidth: 0 }}><Outlet /></div>
      </div>
    </>
  );
}

export function SettingsIndex() {
  const { can } = useAuth();
  const first = SETTINGS_NAV.flatMap((g) => g.items).find((i) => can(i.perm));
  return first ? <Navigate to={`/settings/${first.to}`} replace /> : <p>No settings available for your role.</p>;
}

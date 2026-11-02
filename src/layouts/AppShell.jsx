import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, UserPlus, Users, Building2, Handshake, KanbanSquare, CalendarCheck, LifeBuoy, FileText, Package, Megaphone,
  BarChart3, Settings, Bell, Search, ChevronsLeft, ChevronsRight, LogOut, User, Menu as MenuIcon, Building, Shield, Upload, Workflow,
} from 'lucide-react';
import { get, post } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { moduleEnabled } from '../permissions/can';
import { Avatar, Button, Dropdown, MenuItem, MenuSeparator, Input, Alert } from '../components/ui';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { relative } from '../utils/format';

const NAV = [
  { group: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard:read', end: true }] },
  { group: 'Sales', items: [
    { to: '/leads', label: 'Leads', icon: UserPlus, perm: 'leads:read', module: 'leads' },
    { to: '/contacts', label: 'Contacts', icon: Users, perm: 'contacts:read', module: 'contacts' },
    { to: '/accounts', label: 'Accounts', icon: Building2, perm: 'accounts:read', module: 'accounts' },
    { to: '/opportunities', label: 'Opportunities', icon: Handshake, perm: 'opportunities:read', module: 'opportunities', end: true },
    { to: '/pipeline', label: 'Pipeline', icon: KanbanSquare, perm: 'opportunities:read', module: 'opportunities' },
    { to: '/quotes', label: 'Quotes', icon: FileText, perm: 'quotes:read', module: 'quotes' },
    { to: '/products', label: 'Products', icon: Package, perm: 'products:read', module: 'products' },
  ] },
  { group: 'Engage', items: [
    { to: '/activities', label: 'Activities', icon: CalendarCheck, perm: 'activities:read', module: 'activities' },
    { to: '/campaigns', label: 'Marketing', icon: Megaphone, perm: 'campaigns:read', module: 'campaigns' },
    { to: '/tickets', label: 'Support', icon: LifeBuoy, perm: 'tickets:read', module: 'tickets' },
  ] },
  { group: 'Insights', items: [
    { to: '/reports', label: 'Reports', icon: BarChart3, perm: 'reports:read', module: 'reports' },
    { to: '/imports', label: 'Imports', icon: Upload, perms: ['leads:import', 'contacts:import', 'accounts:import', 'products:import'] },
    { to: '/settings/workflows', label: 'Automation', icon: Workflow, perm: 'workflows:read', module: 'workflows' },
  ] },
];

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const dq = useDebounce(q, 250);
  const navigate = useNavigate();
  const ref = useRef(null);
  const results = useQuery({ queryKey: ['search', dq], queryFn: ({ signal }) => get('/search', { q: dq }, { signal }).then((r) => r.data), enabled: dq.length >= 2 });
  const flat = (results.data || []).flatMap((g) => g.items);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); ref.current?.querySelector('input')?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const go = (item) => { setOpen(false); setQ(''); navigate(item.url); };
  return (
    <div className="search global-search" ref={ref} style={{ position: 'relative' }} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <Search size={15} aria-hidden />
      <Input role="combobox" aria-expanded={open && flat.length > 0} aria-controls="global-search-results" aria-label="Search everything" placeholder="Search leads, contacts, deals…  (Ctrl/⌘ K)"
        value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { setActive((a) => Math.min(a + 1, flat.length - 1)); e.preventDefault(); }
          if (e.key === 'ArrowUp') { setActive((a) => Math.max(a - 1, 0)); e.preventDefault(); }
          if (e.key === 'Enter' && flat[active]) go(flat[active]);
          if (e.key === 'Escape') setOpen(false);
        }} />
      {open && dq.length >= 2 && (
        <div className="search-results" id="global-search-results" role="listbox">
          {results.isLoading && <div className="small muted" style={{ padding: 8 }}>Searching…</div>}
          {results.data && !flat.length && <div className="small muted" style={{ padding: 8 }}>No results for “{dq}”</div>}
          {(results.data || []).map((g) => (
            <div key={g.type}>
              <div className="group-label">{g.label}</div>
              {g.items.map((it) => (
                <a key={it.id} href={it.url} role="option" aria-selected={flat[active]?.id === it.id} onMouseDown={(e) => { e.preventDefault(); go(it); }}>
                  <div>{it.title}</div>{it.subtitle && <div className="small subtle">{it.subtitle}</div>}
                </a>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => get('/me/notifications', { limit: 20 }).then((r) => r.data), refetchInterval: 30_000 });
  const markAll = useMutation({ mutationFn: () => post('/me/notifications/read', {}), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const markOne = (id) => post('/me/notifications/read', { ids: [id] }).then(() => qc.invalidateQueries({ queryKey: ['notifications'] }));
  const unread = q.data?.unread_count || 0;
  return (
    <div style={{ position: 'relative' }}>
      <Button variant="ghost" icon={Bell} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)} />
      {unread > 0 && <span className="counter" aria-hidden>{unread > 99 ? '99+' : unread}</span>}
      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="row between" style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
            <strong>Notifications</strong>
            <Button size="sm" variant="ghost" onClick={() => markAll.mutate()} disabled={!unread}>Mark all read</Button>
          </div>
          {!q.data?.items?.length && <div className="empty small">You're all caught up.</div>}
          {(q.data?.items || []).map((n) => (
            <a key={n.id} href={n.link || '#'} className={`notif-item ${n.read_at ? '' : 'unread'}`} onClick={(e) => { e.preventDefault(); markOne(n.id); setOpen(false); if (n.link) navigate(n.link); }}>
              <div><strong>{n.title}</strong></div>
              {n.body && <div className="small muted">{n.body}</div>}
              <div className="small subtle">{relative(n.created_at)}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const { me, logout, switchTenant, can } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('crm.sidebar') === 'collapsed'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMobileOpen(false), [location.pathname]);
  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem('crm.sidebar', c ? 'open' : 'collapsed'); } catch { /* ignore */ }
      return !c;
    });
  };
  const branding = me.tenant?.settings?.branding || {};
  const visible = (it) => (it.perm ? can(it.perm) : it.perms ? it.perms.some((p) => can(p)) : true) && (!it.module || moduleEnabled(me, it.module));
  return (
    <div className={`shell ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <a className="skip-link" href="#main">Skip to content</a>
      <aside className="sidebar" aria-label="Primary">
        <div className="sidebar-brand">
          <span className="logo">{branding.logo_url ? <img src={branding.logo_url} alt="" /> : (branding.display_name || me.tenant?.name || 'C')[0]}</span>
          <span className="brand-name truncate">{branding.display_name || me.tenant?.name}</span>
        </div>
        <nav>
          {NAV.map((g) => {
            const items = g.items.filter(visible);
            if (!items.length) return null;
            return (
              <div className="nav-group" key={g.group}>
                <div className="nav-group-label">{g.group}</div>
                {items.map((it) => (
                  <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title={collapsed ? it.label : undefined}>
                    <it.icon size={18} aria-hidden /><span className="nav-label">{it.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer stack sm">
          {(can('settings:read') || can('users:read') || can('roles:read') || can('integrations:read') || can('custom_fields:manage')) && (
            <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Settings size={18} aria-hidden /><span className="nav-label">Settings</span></NavLink>
          )}
          {me.user.is_platform_admin && <NavLink to="/platform" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Shield size={18} aria-hidden /><span className="nav-label">Platform admin</span></NavLink>}
          <button className="nav-link btn ghost" style={{ justifyContent: collapsed ? 'center' : 'flex-start', border: 0 }} onClick={toggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}<span className="nav-label">Collapse</span>
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <Button className="mobile-only" variant="ghost" icon={MenuIcon} aria-label="Open navigation" onClick={() => setMobileOpen(true)} />
          <GlobalSearch />
          <div className="grow" />
          <Notifications />
          <Dropdown align="right" label="Account menu" trigger={(p) => (
            <button className="btn ghost" {...p} aria-label="Account menu"><Avatar name={me.user.full_name} src={me.user.avatar_url} /><span className="nav-label truncate" style={{ maxWidth: 140 }}>{me.user.first_name}</span></button>
          )}>
            <div style={{ padding: '8px 10px' }}><strong>{me.user.full_name}</strong><div className="small subtle">{me.user.email}</div></div>
            <MenuSeparator />
            <MenuItem icon={User} onClick={() => (window.location.href = '/profile')}>Profile & security</MenuItem>
            {me.workspaces.length > 1 && <>
              <MenuSeparator />
              <div className="small subtle" style={{ padding: '4px 10px' }}>Switch workspace</div>
              {me.workspaces.map((w) => <MenuItem key={w.id} icon={Building} onClick={() => w.id !== me.tenant?.id && switchTenant(w.id)}>{w.name}{w.id === me.tenant?.id ? ' ✓' : ''}</MenuItem>)}
            </>}
            <MenuSeparator />
            <MenuItem icon={LogOut} onClick={logout}>Sign out</MenuItem>
          </Dropdown>
        </header>
        <main id="main" className="content" tabIndex={-1}>
          {!me.user.email_verified && <div style={{ marginBottom: 16 }}><Alert tone="warning">Please verify your email address — check your inbox for the confirmation link. <ResendVerification /></Alert></div>}
          {me.plan?.status === 'trialing' && me.plan.trial_ends_at && <div className="small subtle" style={{ marginBottom: 8 }}>Trial of {me.plan.name} ends {relative(me.plan.trial_ends_at)}.</div>}
          <ErrorBoundary key={location.pathname}><Outlet /></ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function ResendVerification() {
  const m = useMutation({ mutationFn: () => post('/auth/resend-verification') });
  return <button className="btn sm ghost" onClick={() => m.mutate()} disabled={m.isPending || m.isSuccess}>{m.isSuccess ? 'Sent' : 'Resend link'}</button>;
}

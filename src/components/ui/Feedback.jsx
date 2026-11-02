import { AlertTriangle, Inbox, Info, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { titleCase } from '../../utils/format';

const TONES = {
  new: 'info', contacted: 'brand', nurturing: 'warning', qualified: 'success', unqualified: 'danger', converted: 'success',
  open: 'info', won: 'success', lost: 'danger', completed: 'success', canceled: '', pending: 'warning', on_hold: '', resolved: 'success', closed: '',
  draft: '', pending_approval: 'warning', approved: 'success', rejected: 'danger', sent: 'info', accepted: 'success', declined: 'danger', expired: '', superseded: '',
  hot: 'danger', warm: 'warning', cold: 'info', urgent: 'danger', high: 'warning', normal: '', low: '',
  active: 'success', disabled: '', suspended: 'danger', planned: 'info', aborted: 'danger',
  connected: 'success', configured: 'info', error: 'danger', not_configured: 'warning',
  succeeded: 'success', failed: 'danger', dead: 'danger', running: 'info', queued: 'info', blocked: 'warning', delivered: 'success',
  on_track: 'success', at_risk: 'warning', breached: 'danger', met: 'success', customer: 'success', prospect: 'info', partner: 'brand',
};

export function Badge({ children, tone, value }) {
  const t = tone ?? TONES[value] ?? '';
  return <span className={`badge ${t}`}>{children ?? titleCase(value)}</span>;
}

export const Spinner = ({ label = 'Loading' }) => (
  <span className="row tight muted" role="status"><Loader2 size={16} className="spin" aria-hidden /> {label}</span>
);

export function Skeleton({ rows = 3, height = 14 }) {
  return (
    <div className="stack sm" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton" style={{ height, width: `${90 - (i % 3) * 15}%` }} />)}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon size={22} aria-hidden /></div>
      <strong>{title}</strong>
      {message && <span className="small">{message}</span>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  const forbidden = error?.status === 403;
  return (
    <div className="empty" role="alert">
      <div className="empty-icon" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}><AlertTriangle size={22} aria-hidden /></div>
      <strong>{forbidden ? 'You do not have access' : error?.status === 404 ? 'Not found' : 'Something went wrong'}</strong>
      <span className="small">{error?.message}</span>
      {error?.requestId && <span className="small subtle mono">Request {error.requestId}</span>}
      {onRetry && !forbidden && <Button size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Alert({ tone = 'info', children, icon: Icon = tone === 'info' ? Info : AlertTriangle }) {
  return <div className={`alert ${tone}`} role={tone === 'danger' ? 'alert' : 'note'}><Icon size={16} aria-hidden style={{ flex: 'none', marginTop: 2 }} /><div>{children}</div></div>;
}

/** Placeholder for actions that exist in the roadmap but are not implemented yet. */
export function NotImplemented({ feature }) {
  return <Badge tone="warning">{feature}: planned</Badge>;
}

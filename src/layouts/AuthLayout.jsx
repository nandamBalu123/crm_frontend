import { CheckCircle2 } from 'lucide-react';

export function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-page">
      <div className="auth-hero" aria-hidden>
        <h2>Your customers, one workspace.</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {['Leads, deals and accounts in one 360° view', 'Configurable pipelines, roles and custom fields', 'Automation, reporting and integrations', 'Isolated, secure workspaces for every company'].map((t) => (
            <li key={t} className="row tight"><CheckCircle2 size={18} /> {t}</li>
          ))}
        </ul>
      </div>
      <div className="auth-panel">
        <div className="auth-card stack lg">
          <div className="row tight"><span className="avatar" style={{ background: 'var(--brand)', color: '#fff' }}>C</span><strong>CRM SaaS</strong></div>
          <div className="stack sm"><h1>{title}</h1>{subtitle && <p className="muted" style={{ margin: 0 }}>{subtitle}</p>}</div>
          {children}
        </div>
      </div>
    </div>
  );
}

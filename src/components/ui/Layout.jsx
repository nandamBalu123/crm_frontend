import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { initials } from '../../utils/format';

export function PageHeader({ title, subtitle, breadcrumbs, actions }) {
  return (
    <header className="page-header">
      <div className="stack sm" style={{ gap: 2 }}>
        {breadcrumbs?.length > 0 && (
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="row tight" style={{ gap: 6 }}>
                {b.to ? <Link to={b.to}>{b.label}</Link> : <span aria-current="page">{b.label}</span>}
                {i < breadcrumbs.length - 1 && <ChevronRight size={12} aria-hidden />}
              </span>
            ))}
          </nav>
        )}
        <h1>{title}</h1>
        {subtitle && <div className="page-sub">{subtitle}</div>}
      </div>
      {actions && <div className="row tight">{actions}</div>}
    </header>
  );
}

export function Card({ title, actions, children, flush, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-header">
          {typeof title === 'string' ? <h3>{title}</h3> : title}
          {actions && <div className="row tight">{actions}</div>}
        </div>
      )}
      <div className={`card-body ${flush ? 'flush' : ''}`}>{children}</div>
    </section>
  );
}

export function Kpi({ label, value, sub }) {
  return (
    <div className="card kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export function Avatar({ name, src, size }) {
  if (src) return <img className={`avatar ${size || ''}`} src={src} alt="" />;
  return <span className={`avatar ${size || ''}`} aria-hidden>{initials(name)}</span>;
}

export function DescriptionList({ items }) {
  return (
    <dl className="dl">
      {items.filter(Boolean).map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v === null || v === undefined || v === '' ? <span className="subtle">—</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

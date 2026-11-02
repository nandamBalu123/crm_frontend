import { useEffect, useRef, useState } from 'react';

/** Accessible dropdown menu (click to open, Escape/outside click to close, arrow keys to move). */
export function Dropdown({ trigger, children, align = 'left', label = 'Menu' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const key = (e) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = [...ref.current.querySelectorAll('[role="menuitem"]')];
        const i = items.indexOf(document.activeElement);
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
        e.preventDefault();
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      {trigger({ onClick: () => setOpen((o) => !o), 'aria-haspopup': 'menu', 'aria-expanded': open })}
      {open && (
        <div className="menu" role="menu" aria-label={label} style={{ top: 'calc(100% + 4px)', [align]: 0 }} onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

export const MenuItem = ({ icon: Icon, children, ...props }) => (
  <button role="menuitem" type="button" {...props}>{Icon && <Icon size={15} aria-hidden />}{children}</button>
);
export const MenuSeparator = () => <div className="sep" role="separator" />;

export function Tooltip({ label, children }) {
  return <span className="tooltip">{children}<span role="tooltip">{label}</span></span>;
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" type="button" aria-selected={value === t.value} onClick={() => onChange(t.value)}>
          {t.label}{t.count !== undefined && <span className="badge" style={{ marginLeft: 6, height: 18 }}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

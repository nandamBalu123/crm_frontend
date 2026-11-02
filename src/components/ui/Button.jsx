import { Loader2 } from 'lucide-react';

export function Button({ variant = 'default', size, icon: Icon, loading = false, children, className = '', type = 'button', ...props }) {
  const cls = ['btn', variant !== 'default' && variant, size, !children && Icon && 'icon', className].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} disabled={loading || props.disabled} aria-busy={loading || undefined} {...props}>
      {loading ? <Loader2 size={16} className="spin" aria-hidden /> : Icon ? <Icon size={16} aria-hidden /> : null}
      {children}
    </button>
  );
}

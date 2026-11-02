let settings = { locale: 'en-US', currency: 'USD', timezone: undefined };
export function configureFormatting(s = {}) {
  settings = { locale: s.locale || 'en-US', currency: s.currency || 'USD', timezone: s.timezone || undefined };
}

export function money(value, currency = settings.currency, opts = {}) {
  if (value === null || value === undefined || value === '') return '—';
  try {
    return new Intl.NumberFormat(settings.locale, { style: 'currency', currency, maximumFractionDigits: opts.compact ? 1 : 2, notation: opts.compact ? 'compact' : 'standard' }).format(Number(value));
  } catch {
    return `${currency} ${value}`;
  }
}
export const number = (v, opts) => (v === null || v === undefined ? '—' : new Intl.NumberFormat(settings.locale, opts).format(Number(v)));
export const percent = (v, digits = 0) => (v === null || v === undefined ? '—' : new Intl.NumberFormat(settings.locale, { style: 'percent', maximumFractionDigits: digits }).format(Number(v)));

export function date(v) {
  if (!v) return '—';
  const d = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat(settings.locale, { dateStyle: 'medium', timeZone: /^\d{4}-\d{2}-\d{2}$/.test(v) ? undefined : settings.timezone }).format(d);
}
export function dateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat(settings.locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: settings.timezone }).format(d);
}
export function relative(v) {
  if (!v) return '—';
  const diff = (new Date(v).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(settings.locale, { numeric: 'auto' });
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return date(v);
}
export const titleCase = (s) => String(s ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export const fullName = (r) => [r?.first_name, r?.last_name].filter(Boolean).join(' ') || r?.name || '—';
export const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
/** For <input type="datetime-local">: ISO → local "YYYY-MM-DDTHH:mm" and back. */
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

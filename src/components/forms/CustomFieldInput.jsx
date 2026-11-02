import { Field, Input, Select, Textarea, Checkbox } from '../ui';
import { useMembers } from '../../hooks/useCustomFields';

/** Renders the right control for a custom-field definition. Values are strings/arrays as the API expects. */
export function CustomFieldInput({ def, value, onChange, error, readOnly }) {
  const members = useMembers();
  const v = def.validation || {};
  const common = { disabled: readOnly, placeholder: def.placeholder || undefined };
  const control = (a11y) => {
    switch (def.field_type) {
      case 'textarea': return <Textarea {...a11y} {...common} value={value ?? ''} maxLength={v.max_length || 10000} onChange={(e) => onChange(e.target.value)} />;
      case 'integer': case 'decimal': case 'currency': case 'percent':
        return <Input {...a11y} {...common} type="number" inputMode="decimal" step={def.field_type === 'integer' ? 1 : 'any'} min={v.min ?? (def.field_type === 'percent' ? 0 : undefined)} max={v.max ?? (def.field_type === 'percent' ? 100 : undefined)} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
      case 'boolean': return <Checkbox label={def.label} checked={!!value} disabled={readOnly} onChange={(e) => onChange(e.target.checked)} />;
      case 'date': return <Input {...a11y} {...common} type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
      case 'datetime': return <Input {...a11y} {...common} type="datetime-local" value={value ? value.slice(0, 16) : ''} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : '')} />;
      case 'select': return <Select {...a11y} {...common} placeholder="—" value={value ?? ''} options={(def.options || []).filter((o) => o.is_active !== false || o.value === value).map((o) => ({ value: o.value, label: o.label }))} onChange={(e) => onChange(e.target.value)} />;
      case 'multiselect':
        return (
          <div className="row tight" {...a11y} role="group">
            {(def.options || []).filter((o) => o.is_active !== false || (value || []).includes(o.value)).map((o) => (
              <Checkbox key={o.value} label={o.label} disabled={readOnly} checked={(value || []).includes(o.value)}
                onChange={(e) => onChange(e.target.checked ? [...(value || []), o.value] : (value || []).filter((x) => x !== o.value))} />
            ))}
          </div>
        );
      case 'user': return <Select {...a11y} {...common} placeholder="—" value={value ?? ''} options={(members.data || []).map((m) => ({ value: m.user_id, label: `${m.user.first_name} ${m.user.last_name}`.trim() }))} onChange={(e) => onChange(e.target.value)} />;
      case 'email': return <Input {...a11y} {...common} type="email" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
      case 'phone': return <Input {...a11y} {...common} type="tel" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
      case 'url': return <Input {...a11y} {...common} type="url" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
      case 'file': return <Input {...a11y} disabled value={value ?? ''} placeholder="Attach files from the record's Files tab" readOnly />;
      default: return <Input {...a11y} {...common} value={value ?? ''} maxLength={v.max_length || 255} onChange={(e) => onChange(e.target.value)} />;
    }
  };
  if (def.field_type === 'boolean') return <div className="field">{control({})}{error && <span className="error">{error}</span>}</div>;
  return <Field label={def.label} required={def.is_required} error={error} hint={def.description}>{control}</Field>;
}

/** Display formatting for a stored custom-field value. */
export function formatCustomValue(def, value) {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) return null;
  const label = (val) => def.options?.find((o) => o.value === val)?.label || val;
  if (def.field_type === 'boolean') return value ? 'Yes' : 'No';
  if (def.field_type === 'select') return label(value);
  if (def.field_type === 'multiselect') return value.map(label).join(', ');
  if (def.field_type === 'percent') return `${value}%`;
  if (def.field_type === 'url') return <a href={value} target="_blank" rel="noopener noreferrer">{value}</a>;
  if (def.field_type === 'email') return <a href={`mailto:${value}`}>{value}</a>;
  if (def.field_type === 'datetime') return new Date(value).toLocaleString();
  return String(value);
}

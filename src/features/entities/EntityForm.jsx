import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useCustomFields, useMembers } from '../../hooks/useCustomFields';
import { useDebounce } from '../../hooks/useDebounce';
import { CustomFieldInput } from '../../components/forms/CustomFieldInput';
import { Field, Input, Select, Textarea, Checkbox, Alert } from '../../components/ui';
import { fieldAccess } from '../../permissions/can';
import { toLocalInput, fromLocalInput, fullName } from '../../utils/format';
import { ENTITIES } from './config';

/** Async lookup select for related records (account, contact). */
export function LookupSelect({ entity, value, onChange, id, disabled, initialLabel, ...a11y }) {
  const cfg = ENTITIES[entity];
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 250);
  const list = useQuery({ queryKey: ['lookup', entity, dq], queryFn: () => get(`/${cfg.route}`, { q: dq || undefined, page_size: 20, sort: entity === 'account' ? 'name' : undefined }), staleTime: 30_000 });
  const options = (list.data?.data || []).map((r) => ({ value: r.id, label: cfg.title(r) }));
  if (value && !options.some((o) => o.value === value)) options.unshift({ value, label: initialLabel || 'Current selection' });
  return (
    <div className="stack sm">
      <Input aria-label={`Search ${cfg.plural.toLowerCase()}`} placeholder={`Search ${cfg.plural.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} disabled={disabled} />
      <Select id={id} {...a11y} disabled={disabled} value={value || ''} placeholder="— None —" options={options} onChange={(e) => onChange(e.target.value || null)} />
    </div>
  );
}

function StandardInput({ f, value, onChange, a11y, me, members, readOnly, record }) {
  const prefOptions = f.type === 'pref' ? (me?.tenant?.settings?.preferences?.[f.pref] || []).map((v) => ({ value: v, label: v.replace(/_/g, ' ') })) : null;
  switch (f.type) {
    case 'textarea': return <Textarea {...a11y} value={value ?? ''} disabled={readOnly} onChange={(e) => onChange(e.target.value)} />;
    case 'select': return <Select {...a11y} value={value ?? ''} disabled={readOnly} placeholder="—" options={f.options} onChange={(e) => onChange(e.target.value || null)} />;
    case 'pref': return <Select {...a11y} value={value ?? ''} disabled={readOnly} placeholder="—" options={value && !prefOptions.some((o) => o.value === value) ? [...prefOptions, { value, label: value }] : prefOptions} onChange={(e) => onChange(e.target.value || null)} />;
    case 'owner': return <Select {...a11y} value={value ?? ''} disabled={readOnly} placeholder="—" options={(members || []).map((m) => ({ value: m.user_id, label: fullName(m.user) }))} onChange={(e) => onChange(e.target.value || null)} />;
    case 'checkbox': return <Checkbox label={f.label} checked={!!value} disabled={readOnly} onChange={(e) => onChange(e.target.checked)} />;
    case 'datetime': return <Input {...a11y} type="datetime-local" disabled={readOnly} value={toLocalInput(value)} onChange={(e) => onChange(fromLocalInput(e.target.value))} />;
    case 'lookup': {
      const rel = { account_id: record?.account, parent_account_id: record?.parent, contact_id: record?.contact }[f.key];
      return <LookupSelect entity={f.lookup} {...a11y} disabled={readOnly} value={value} initialLabel={rel ? ENTITIES[f.lookup].title(rel) : undefined} onChange={onChange} />;
    }
    default: return <Input {...a11y} type={f.type || 'text'} step={f.type === 'number' ? 'any' : undefined} disabled={readOnly} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }
}

/**
 * Generic create/edit form: standard fields from the entity config plus the
 * tenant's active custom fields. Hidden fields (field-level permissions) are
 * not rendered; read-only fields render disabled. Server validation errors
 * map back onto fields.
 */
export function EntityForm({ entityType, record, values, onChange, errors = {}, formError, compact = false }) {
  const { me } = useAuth();
  const cfg = ENTITIES[entityType];
  const cfDefs = useCustomFields(entityType);
  const members = useMembers();
  const fields = useMemo(() => cfg.fields.filter((f) => !compact || f.required || ['owner_id', 'email', 'company', 'amount', 'account_id', 'due_at'].includes(f.key)), [cfg, compact]);
  const set = (k, v) => onChange({ ...values, [k]: v });
  const setCf = (k, v) => onChange({ ...values, custom_fields: { ...(values.custom_fields || {}), [k]: v } });
  let lastSection = null;
  return (
    <div className="stack">
      {formError && <Alert tone="danger">{formError}</Alert>}
      <div className="form-grid">
        {fields.map((f) => {
          const access = fieldAccess(me, entityType, f.key);
          if (access === 'hidden') return null;
          const header = f.section && f.section !== lastSection ? <div className="form-section" key={`s-${f.section}`}>{f.section}</div> : null;
          if (f.section) lastSection = f.section;
          return [header, (
            <div key={f.key} className={f.full ? 'full' : ''}>
              {f.type === 'checkbox'
                ? <div className="field" style={{ paddingTop: 22 }}><StandardInput f={f} value={values[f.key]} onChange={(v) => set(f.key, v)} me={me} readOnly={access === 'read'} />{errors[f.key] && <span className="error">{errors[f.key]}</span>}</div>
                : <Field label={f.label} required={f.required} error={errors[f.key]} hint={access === 'read' ? 'Read-only for your role' : undefined}>
                    {(a11y) => <StandardInput f={f} value={values[f.key]} onChange={(v) => set(f.key, v)} a11y={a11y} me={me} members={members.data} readOnly={access === 'read'} record={record} />}
                  </Field>}
            </div>
          )];
        })}
        {(cfDefs.data || []).length > 0 && <div className="form-section">Custom fields</div>}
        {(cfDefs.data || []).map((def) => {
          const access = fieldAccess(me, entityType, `cf.${def.key}`);
          if (access === 'hidden') return null;
          return (
            <div key={def.id} className={def.field_type === 'textarea' || def.field_type === 'multiselect' ? 'full' : ''}>
              <CustomFieldInput def={def} value={values.custom_fields?.[def.key]} onChange={(v) => setCf(def.key, v)} error={errors[`custom_fields.${def.key}`]} readOnly={access === 'read'} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Builds the request body: only changed keys on edit; empty strings → null. */
export function buildPayload(values, original) {
  const out = {};
  for (const [k, v] of Object.entries(values)) {
    if (k === 'custom_fields') continue;
    const norm = v === '' ? null : v;
    if (!original || JSON.stringify(original[k] ?? null) !== JSON.stringify(norm ?? null)) out[k] = norm;
  }
  const cf = {};
  for (const [k, v] of Object.entries(values.custom_fields || {})) {
    const norm = v === '' ? null : v;
    if (!original || JSON.stringify(original.custom_fields?.[k] ?? null) !== JSON.stringify(norm ?? null)) cf[k] = norm;
  }
  if (Object.keys(cf).length) out.custom_fields = cf;
  return out;
}

export function useFormState(initial) {
  const [values, setValues] = useState(initial);
  useEffect(() => setValues(initial), [initial]);
  return [values, setValues];
}

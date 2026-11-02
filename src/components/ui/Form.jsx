import { forwardRef, useId } from 'react';

/** Labelled field wrapper with accessible error/hint wiring. */
export function Field({ label, required, error, hint, children, className = '', id: idProp }) {
  const auto = useId();
  const id = idProp || auto;
  const describedBy = [error && `${id}-err`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  const child = typeof children === 'function' ? children({ id, 'aria-invalid': !!error || undefined, 'aria-describedby': describedBy }) : children;
  return (
    <div className={`field ${className}`}>
      {label && <label htmlFor={id}>{label}{required && <span className="req" aria-hidden>*</span>}</label>}
      {child}
      {hint && !error && <span id={`${id}-hint`} className="hint">{hint}</span>}
      {error && <span id={`${id}-err`} className="error" role="alert">{error}</span>}
    </div>
  );
}

export const Input = forwardRef(function Input({ className = '', ...props }, ref) {
  return <input ref={ref} className={`input ${className}`} {...props} />;
});
export const Textarea = forwardRef(function Textarea({ className = '', ...props }, ref) {
  return <textarea ref={ref} className={`textarea ${className}`} {...props} />;
});
export const Select = forwardRef(function Select({ options = [], placeholder, className = '', ...props }, ref) {
  return (
    <select ref={ref} className={`select ${className}`} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>))}
    </select>
  );
});
export function Checkbox({ label, ...props }) {
  return (
    <label className="checkbox">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}

/** Text/number/date/etc. field with label in one call. */
export function TextField({ label, required, error, hint, as = 'input', options, className, ...props }) {
  const Control = as === 'textarea' ? Textarea : as === 'select' ? Select : Input;
  return (
    <Field label={label} required={required} error={error} hint={hint} className={className}>
      {(a11y) => <Control {...a11y} required={required} options={options} {...props} />}
    </Field>
  );
}

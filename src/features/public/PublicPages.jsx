import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { get, post } from '../../api/client';
import { Alert, Button, Checkbox, Spinner, TextField } from '../../components/ui';

/** Hosted lead-capture form (/f/:key). Same endpoint used by embedded forms. */
export function PublicFormPage() {
  const { key } = useParams();
  const form = useQuery({ queryKey: ['public-form', key], queryFn: () => get(`/public/forms/${key}`).then((r) => r.data), retry: false });
  const [data, setData] = useState({});
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState('');
  const [errors, setErrors] = useState({});
  const submit = useMutation({
    mutationFn: () => post(`/public/forms/${key}/submit`, { data, consent, ...(hp ? { _hp: hp } : {}) }),
    onSuccess: (res) => { if (res.data.redirect_url) window.location.assign(res.data.redirect_url); },
    onError: (e) => setErrors(e.fieldErrors?.() || {}),
  });
  if (form.isLoading) return <div className="auth-panel"><Spinner /></div>;
  if (form.isError) return <div className="auth-panel"><Alert tone="danger">This form is not available.</Alert></div>;
  const f = form.data;
  return (
    <div className="auth-panel" style={{ minHeight: '100vh' }}>
      <div className="card auth-card"><div className="card-body stack">
        <div className="small subtle">{f.company}</div>
        <h1>{f.name}</h1>
        {submit.isSuccess ? <Alert tone="success">{submit.data.data.message}</Alert> : (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); setErrors({}); submit.mutate(); }}>
            {submit.error && !Object.keys(errors).length && <Alert tone="danger">{submit.error.message}</Alert>}
            {f.fields.map((fld) => fld.type === 'checkbox'
              ? <Checkbox key={fld.key} label={fld.label} checked={!!data[fld.key]} onChange={(e) => setData({ ...data, [fld.key]: e.target.checked })} />
              : <TextField key={fld.key} label={fld.label} required={fld.required} as={fld.type === 'textarea' ? 'textarea' : fld.type === 'select' ? 'select' : 'input'}
                  type={['email', 'number', 'url'].includes(fld.type) ? fld.type : fld.type === 'phone' ? 'tel' : 'text'} options={fld.options} placeholder={fld.type === 'select' ? 'Choose…' : fld.placeholder}
                  value={data[fld.key] ?? ''} onChange={(e) => setData({ ...data, [fld.key]: e.target.value })} error={errors[fld.key]} />)}
            <div aria-hidden style={{ position: 'absolute', left: '-9999px' }}><label>Leave empty<input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} /></label></div>
            {(f.consent_text || f.require_consent) && <Checkbox label={f.consent_text || 'I agree to be contacted'} checked={consent} onChange={(e) => setConsent(e.target.checked)} />}
            {errors.consent && <span className="error small">{errors.consent}</span>}
            <Button type="submit" variant="primary" loading={submit.isPending}>Submit</Button>
          </form>
        )}
      </div></div>
    </div>
  );
}

export function UnsubscribePage() {
  const [sp] = useSearchParams();
  const token = sp.get('token');
  const info = useQuery({ queryKey: ['unsub', token], queryFn: () => get(`/public/unsubscribe/${token}`).then((r) => r.data), retry: false, enabled: !!token });
  const m = useMutation({ mutationFn: () => post(`/public/unsubscribe/${token}`) });
  return (
    <div className="auth-panel" style={{ minHeight: '100vh' }}>
      <div className="card auth-card"><div className="card-body stack">
        <h1>Email preferences</h1>
        {info.isError && <Alert tone="danger">{info.error.message}</Alert>}
        {info.data && (m.isSuccess || info.data.already_unsubscribed
          ? <Alert tone="success">{info.data.email} has been unsubscribed from marketing email.</Alert>
          : <><p>Unsubscribe <strong>{info.data.email}</strong> from marketing email?</p><Button variant="primary" loading={m.isPending} onClick={() => m.mutate()}>Unsubscribe</Button></>)}
      </div></div>
    </div>
  );
}

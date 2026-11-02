import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { api, get, post } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Select, Skeleton, TextField, Spinner } from '../../components/ui';
import { dateTime, relative } from '../../utils/format';

export function ImportsPage() {
  const list = useQuery({ queryKey: ['imports'], queryFn: () => get('/imports').then((r) => r.data) });
  return (
    <>
      <PageHeader title="Imports" actions={<Link to="/imports/new" className="btn primary"><Upload size={16} /> New import</Link>} />
      <Card flush>
        {list.isLoading ? <div className="card-body"><Skeleton /></div> : !list.data?.length ? <EmptyState title="No imports yet" message="Import leads, contacts, accounts or products from CSV." /> : (
          <table className="table"><thead><tr><th>File</th><th>Object</th><th>Status</th><th className="right">Rows</th><th className="right">Created</th><th className="right">Updated</th><th className="right">Skipped</th><th className="right">Errors</th><th>Started</th></tr></thead>
            <tbody>{list.data.map((i) => <tr key={i.id}><td><Link to={`/imports/${i.id}`}>{i.filename}</Link></td><td>{i.entity_type}</td><td><Badge value={i.status === 'completed' ? 'completed' : i.status} /></td><td className="right">{i.total_rows}</td><td className="right">{i.created_rows}</td><td className="right">{i.updated_rows}</td><td className="right">{i.skipped_rows}</td><td className="right">{i.error_rows}</td><td>{relative(i.created_at)}</td></tr>)}</tbody></table>
        )}
      </Card>
    </>
  );
}

export function ImportWizardPage() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [entity, setEntity] = useState(sp.get('entity') || 'lead');
  const [file, setFile] = useState(null);
  const [state, setState] = useState(null);
  const [mapping, setMapping] = useState({});
  const [check, setCheck] = useState(null);
  const [strategy, setStrategy] = useState('skip');
  const upload = useMutation({
    mutationFn: () => { const f = new FormData(); f.append('entity_type', entity); f.append('file', file); return api.post('/imports', f).then((r) => r.data.data); },
    onSuccess: (d) => { setState(d); setMapping(d.import.mapping); setCheck(null); }, onError: (e) => toast.error(e),
  });
  const validate = useMutation({ mutationFn: () => post(`/imports/${state.import.id}/validate`, { mapping }).then((r) => r.data), onSuccess: setCheck, onError: (e) => toast.error(e) });
  const start = useMutation({ mutationFn: () => post(`/imports/${state.import.id}/start`, { duplicate_strategy: strategy }), onSuccess: () => navigate(`/imports/${state.import.id}`), onError: (e) => toast.error(e) });
  return (
    <>
      <PageHeader breadcrumbs={[{ label: 'Imports', to: '/imports' }, { label: 'New import' }]} title="Import from CSV" />
      <div className="stack">
        <Card title="1. Upload">
          <div className="row">
            <Select aria-label="Object type" value={entity} onChange={(e) => setEntity(e.target.value)} options={[{ value: 'lead', label: 'Leads' }, { value: 'contact', label: 'Contacts' }, { value: 'account', label: 'Accounts' }, { value: 'product', label: 'Products' }]} />
            <input type="file" accept=".csv,text/csv" aria-label="CSV file" onChange={(e) => setFile(e.target.files[0])} />
            <Button variant="primary" disabled={!file} loading={upload.isPending} onClick={() => upload.mutate()}>Upload & preview</Button>
          </div>
          <p className="small subtle" style={{ marginTop: 8 }}>UTF-8 CSV with a header row, up to 50,000 rows. Owners can be matched by an “owner email” column.</p>
        </Card>
        {state && (
          <Card title={`2. Map columns (${state.import.total_rows} rows)`}>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>CSV column</th><th>Sample</th><th>Maps to</th></tr></thead>
              <tbody>{state.import.headers.map((h) => (
                <tr key={h}><td><strong>{h}</strong></td><td className="small muted">{state.preview.slice(0, 2).map((r) => r[h]).filter(Boolean).join(' · ')}</td>
                  <td><Select aria-label={`Map ${h}`} value={mapping[h] || ''} placeholder="— Skip column —" options={state.target_fields.map((t) => ({ value: t, label: t }))} onChange={(e) => setMapping({ ...mapping, [h]: e.target.value || null })} /></td></tr>
              ))}</tbody>
            </table></div>
            <div className="row end" style={{ marginTop: 12 }}><Button loading={validate.isPending} onClick={() => validate.mutate()}>Validate</Button></div>
          </Card>
        )}
        {check && (
          <Card title="3. Review & start">
            <div className="stack">
              <Alert tone={check.errors.length ? 'warning' : 'success'}>{check.valid} of {check.checked} checked rows are valid.{check.errors.length > 0 && ' Rows with errors will be skipped and reported.'}</Alert>
              {check.errors.slice(0, 20).map((e) => <div key={e.row} className="small"><strong>Row {e.row}:</strong> {e.errors.map((x) => `${x.path ? `${x.path}: ` : ''}${x.message}`).join('; ')}</div>)}
              <TextField as="select" label="When a duplicate is found" value={strategy} onChange={(e) => setStrategy(e.target.value)} options={[{ value: 'skip', label: 'Skip the row' }, { value: 'update', label: 'Update the existing record' }, { value: 'create', label: 'Create anyway' }]} />
              <div className="row end"><Button variant="primary" loading={start.isPending} onClick={() => start.mutate()}>Start import</Button></div>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

export function ImportStatusPage() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ['imports', id], queryFn: () => get(`/imports/${id}`).then((r) => r.data), refetchInterval: (query) => (['queued', 'processing'].includes(query.state.data?.status) ? 2000 : false) });
  const i = q.data;
  return (
    <>
      <PageHeader breadcrumbs={[{ label: 'Imports', to: '/imports' }, { label: i?.filename || '…' }]} title={i?.filename || 'Import'} />
      {!i ? <Skeleton /> : (
        <div className="stack">
          <Card>
            <div className="row">{['queued', 'processing'].includes(i.status) ? <Spinner label={`Processing ${i.processed_rows} / ${i.total_rows}`} /> : <Badge value={i.status} />}
              <span>{i.created_rows} created · {i.updated_rows} updated · {i.skipped_rows} skipped · {i.error_rows} errors</span><span className="subtle small">{dateTime(i.completed_at)}</span></div>
          </Card>
          {i.errors?.length > 0 && <Card title="Row errors" flush><table className="table"><tbody>{i.errors.map((e) => <tr key={e.row}><td>Row {e.row}</td><td style={{ whiteSpace: 'normal' }}>{e.errors.map((x) => `${x.path ? `${x.path}: ` : ''}${x.message}`).join('; ')}</td></tr>)}</tbody></table></Card>}
        </div>
      )}
    </>
  );
}

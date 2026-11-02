import { Link, useNavigate } from 'react-router';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { get, post } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useListParams } from '../../hooks/useListParams';
import { DataTable, Pagination } from '../../components/data/DataTable';
import { Badge, Button, PageHeader, Select } from '../../components/ui';
import { money, date } from '../../utils/format';

export function QuotesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { state, update, apiParams } = useListParams({ sort: '-created_at' });
  const list = useQuery({ queryKey: ['quotes', apiParams], queryFn: () => get('/quotes', apiParams), placeholderData: keepPreviousData });
  const create = useMutation({ mutationFn: () => post('/quotes', { title: 'New quote', line_items: [] }), onSuccess: (r) => navigate(`/quotes/${r.data.id}`), onError: (e) => toast.error(e) });
  return (
    <>
      <PageHeader title="Quotes & proposals" actions={can('quotes:create') && <Button variant="primary" icon={Plus} loading={create.isPending} onClick={() => create.mutate()}>New quote</Button>} />
      <div className="card">
        <div className="toolbar">
          <Select aria-label="Status" style={{ width: 200 }} value={state.filter.status || ''} placeholder="All statuses" options={['draft', 'pending_approval', 'approved', 'rejected', 'sent', 'accepted', 'declined', 'expired', 'superseded'].map((s) => ({ value: s, label: s.replace('_', ' ') }))} onChange={(e) => update({ filter: e.target.value ? { status: e.target.value } : {} })} />
        </div>
        <DataTable rows={list.data?.data} loading={list.isLoading} error={list.error} sort={state.sort} onSort={(s) => update({ sort: s })} onRowClick={(r) => navigate(`/quotes/${r.id}`)}
          columns={[
            { key: 'number', label: 'Number', sortable: true, render: (r) => <Link to={`/quotes/${r.id}`}>Q-{r.number}{r.revision > 1 ? ` rev ${r.revision}` : ''}</Link> },
            { key: 'title', label: 'Title' }, { key: 'account', label: 'Account', render: (r) => r.account?.name },
            { key: 'status', label: 'Status', sortable: true, render: (r) => <Badge value={r.status} /> },
            { key: 'total', label: 'Total', sortable: true, align: 'right', render: (r) => money(r.total, r.currency) },
            { key: 'valid_until', label: 'Valid until', sortable: true, render: (r) => date(r.valid_until) },
            { key: 'owner', label: 'Owner', render: (r) => r.owner?.name },
          ]} />
        <Pagination meta={list.data?.meta} onPage={(page) => update({ page })} />
      </div>
    </>
  );
}

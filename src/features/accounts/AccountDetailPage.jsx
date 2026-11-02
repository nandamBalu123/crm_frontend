import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { get } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, DescriptionList } from '../../components/ui';
import { RecordPage } from '../entities/RecordPage';
import { RelatedTable } from '../entities/RecordParts';
import { CreateDrawer } from '../entities/EntityListPage';
import { money, date, fullName, number } from '../../utils/format';

export function AccountDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [creating, setCreating] = useState(null);
  const related = useQuery({ queryKey: ['accounts', id, 'related'], queryFn: () => get(`/accounts/${id}/related`).then((r) => r.data) });
  const rel = related.data || {};
  const openValue = (rel.opportunities?.items || []).filter((o) => o.status === 'open').reduce((s, o) => s + Number(o.amount || 0), 0);
  return (
    <>
      <RecordPage entityType="account" id={id}
        headerExtra={(r) => <Badge value={r.type} />}
        composerLinks={(r) => ({ account_id: r.id })}
        actions={() => <>
          {can('contacts:create') && <Button icon={Plus} onClick={() => setCreating('contact')}>Contact</Button>}
          {can('opportunities:create') && <Button icon={Plus} onClick={() => setCreating('opportunity')}>Deal</Button>}
        </>}
        tabs={[
          { value: 'contacts', label: 'Contacts', count: rel.contacts?.total, render: () => <RelatedTable title="Contacts" block={rel.contacts} columns={[{ key: 'n', render: (c) => <Link to={`/contacts/${c.id}`}>{fullName(c)}</Link> }, { key: 't', render: (c) => c.title }, { key: 'e', render: (c) => c.email }]} /> },
          { value: 'deals', label: 'Deals', count: rel.opportunities?.total, render: () => <RelatedTable title="Opportunities" block={rel.opportunities} columns={[{ key: 'n', render: (o) => <Link to={`/opportunities/${o.id}`}>{o.name}</Link> }, { key: 's', render: (o) => <Badge value={o.status}>{o.stage?.name}</Badge> }, { key: 'a', render: (o) => money(o.amount, o.currency) }, { key: 'd', render: (o) => date(o.expected_close_date) }]} /> },
          { value: 'tickets', label: 'Tickets', count: rel.tickets?.total, render: () => <RelatedTable title="Tickets" block={rel.tickets} columns={[{ key: 'n', render: (t) => <Link to={`/tickets/${t.id}`}>#{t.number} {t.subject}</Link> }, { key: 's', render: (t) => <Badge value={t.status} /> }]} /> },
          { value: 'quotes', label: 'Quotes', count: rel.quotes?.total, render: () => <RelatedTable title="Quotes" block={rel.quotes} columns={[{ key: 'n', render: (q) => <Link to={`/quotes/${q.id}`}>Q-{q.number} {q.title}</Link> }, { key: 's', render: (q) => <Badge value={q.status} /> }, { key: 't', render: (q) => money(q.total, q.currency) }]} /> },
        ]}
        details={(r) => (
          <Card title="Account details">
            <DescriptionList items={[
              ['Open pipeline', <strong key="p">{money(openValue)}</strong>], ['Website', r.website && <a href={r.website} target="_blank" rel="noopener noreferrer">{r.domain || r.website}</a>],
              ['Industry', r.industry], ['Employees', r.employees && number(r.employees)], ['Annual revenue', r.annual_revenue && money(r.annual_revenue)],
              ['Phone', r.phone], ['Email', r.email], ['Address', [r.address_line1, r.city, r.state, r.postal_code, r.country].filter(Boolean).join(', ')],
              ['Parent account', r.parent_account_id && <Link to={`/accounts/${r.parent_account_id}`}>View parent</Link>], ['Owner', r.owner?.name],
            ]} />
          </Card>
        )}
        sideExtra={() => rel.child_accounts?.total > 0 && <RelatedTable title="Subsidiaries" block={rel.child_accounts} columns={[{ key: 'n', render: (a) => <Link to={`/accounts/${a.id}`}>{a.name}</Link> }]} />} />
      <CreateDrawer entityType="contact" open={creating === 'contact'} onClose={() => setCreating(null)} initial={{ account_id: id }} onCreated={() => related.refetch()} />
      <CreateDrawer entityType="opportunity" open={creating === 'opportunity'} onClose={() => setCreating(null)} initial={{ account_id: id }} onCreated={() => related.refetch()} />
    </>
  );
}

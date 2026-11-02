import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Mail, Plus } from 'lucide-react';
import { get } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, DescriptionList } from '../../components/ui';
import { RecordPage } from '../entities/RecordPage';
import { EmailComposer, RelatedTable } from '../entities/RecordParts';
import { CreateDrawer } from '../entities/EntityListPage';
import { dateTime, money, date } from '../../utils/format';

export function ContactDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [emailing, setEmailing] = useState(false);
  const [newDeal, setNewDeal] = useState(false);
  const related = useQuery({ queryKey: ['contacts', id, 'related'], queryFn: () => get(`/contacts/${id}/related`).then((r) => r.data) });
  const consents = useQuery({ queryKey: ['contacts', id, 'consents'], queryFn: () => get(`/contacts/${id}/consents`).then((r) => r.data) });
  const rel = related.data || {};
  return (
    <>
      <RecordPage entityType="contact" id={id}
        composerLinks={(r) => ({ contact_id: r.id })}
        headerExtra={(r) => r.email_opt_out && <Badge tone="warning">Email opt-out</Badge>}
        actions={(r) => <>
          {r.email && can('communications:create') && <Button icon={Mail} onClick={() => setEmailing(true)} disabled={r.email_opt_out} title={r.email_opt_out ? 'Contact opted out of email' : undefined}>Email</Button>}
          {can('opportunities:create') && <Button icon={Plus} onClick={() => setNewDeal(true)}>New deal</Button>}
        </>}
        tabs={[
          { value: 'deals', label: 'Deals', count: rel.opportunities?.total, render: () => <RelatedTable title="Opportunities" block={rel.opportunities} columns={[{ key: 'name', render: (o) => <Link to={`/opportunities/${o.id}`}>{o.name}</Link> }, { key: 'stage', render: (o) => <Badge value={o.status}>{o.stage?.name}</Badge> }, { key: 'amount', render: (o) => money(o.amount, o.currency) }, { key: 'close', render: (o) => date(o.expected_close_date) }]} /> },
          { value: 'tickets', label: 'Tickets', count: rel.tickets?.total, render: () => <RelatedTable title="Tickets" block={rel.tickets} columns={[{ key: 'n', render: (t) => <Link to={`/tickets/${t.id}`}>#{t.number} {t.subject}</Link> }, { key: 's', render: (t) => <Badge value={t.status} /> }, { key: 'p', render: (t) => <Badge value={t.priority} /> }]} /> },
          { value: 'quotes', label: 'Quotes', count: rel.quotes?.total, render: () => <RelatedTable title="Quotes" block={rel.quotes} columns={[{ key: 'n', render: (q) => <Link to={`/quotes/${q.id}`}>Q-{q.number} {q.title}</Link> }, { key: 's', render: (q) => <Badge value={q.status} /> }, { key: 't', render: (q) => money(q.total, q.currency) }]} /> },
        ]}
        details={(r) => (
          <Card title="Contact details">
            <DescriptionList items={[
              ['Email', r.email && <a href={`mailto:${r.email}`}>{r.email}</a>], ['Phone', r.phone && <a href={`tel:${r.phone}`}>{r.phone}</a>], ['Mobile', r.mobile],
              ['Account', r.account && <Link to={`/accounts/${r.account.id}`}>{r.account.name}</Link>], ['Title', r.title], ['Department', r.department],
              ['Source', r.lead_source], ['LinkedIn', r.linkedin_url && <a href={r.linkedin_url} target="_blank" rel="noopener noreferrer">Profile</a>],
              ['Location', [r.city, r.country].filter(Boolean).join(', ')], ['Owner', r.owner?.name], ['Last activity', dateTime(r.last_activity_at)],
              ['Converted from lead', r.converted_from_lead_id && <Link to={`/leads/${r.converted_from_lead_id}`}>View lead</Link>],
            ]} />
          </Card>
        )}
        sideExtra={() => (
          <>
            <RelatedTable title="Open activities" block={rel.open_activities} columns={[{ key: 's', render: (a) => a.subject }, { key: 'd', render: (a) => <span className={a.is_overdue ? 'badge danger' : 'small subtle'}>{dateTime(a.due_at)}</span> }]} />
            <Card title="Consent history">
              {!consents.data?.length ? <span className="small subtle">No consent records.</span> : (
                <ul className="stack sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {consents.data.slice(0, 6).map((c) => <li key={c.id} className="small"><Badge tone={c.status === 'granted' ? 'success' : 'warning'}>{c.channel} {c.status}</Badge> <span className="subtle">{c.source} · {dateTime(c.created_at)}</span></li>)}
                </ul>
              )}
            </Card>
          </>
        )} />
      {emailing && <EmailComposer open onClose={() => setEmailing(false)} recipient={{ contact_id: id }} />}
      <CreateDrawer entityType="opportunity" open={newDeal} onClose={() => setNewDeal(false)} initial={{ contact_id: id }} onCreated={() => related.refetch()} />
    </>
  );
}

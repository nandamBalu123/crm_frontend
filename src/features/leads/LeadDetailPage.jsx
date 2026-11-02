import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, Mail } from 'lucide-react';
import { get, post } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Alert, Badge, Button, Card, Checkbox, DescriptionList, Modal, TextField } from '../../components/ui';
import { RecordPage } from '../entities/RecordPage';
import { EmailComposer } from '../entities/RecordParts';
import { LookupSelect } from '../entities/EntityForm';
import { dateTime, fullName, money } from '../../utils/format';

function ConvertModal({ lead, open, onClose }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [createAccount, setCreateAccount] = useState(!!lead.company);
  const [accountId, setAccountId] = useState(null);
  const [createOpp, setCreateOpp] = useState(true);
  const [opp, setOpp] = useState({ name: `${lead.company || fullName(lead)} deal`, amount: '', expected_close_date: '' });
  const dups = useQuery({ queryKey: ['lead-dups', lead.id], queryFn: () => get('/leads/duplicates', { email: lead.email || undefined, exclude_id: lead.id }).then((r) => r.data), enabled: open && !!lead.email });
  const [contactId, setContactId] = useState('');
  const convert = useMutation({
    mutationFn: () => post(`/leads/${lead.id}/convert`, {
      create_account: createAccount && !accountId, ...(accountId ? { account_id: accountId } : {}), ...(contactId ? { contact_id: contactId } : {}),
      create_opportunity: createOpp, ...(createOpp ? { opportunity: { name: opp.name, ...(opp.amount ? { amount: opp.amount } : {}), ...(opp.expected_close_date ? { expected_close_date: opp.expected_close_date } : {}) } } : {}),
    }),
    onSuccess: (res) => {
      toast.success('Lead converted');
      qc.invalidateQueries();
      navigate(res.data.opportunity_id ? `/opportunities/${res.data.opportunity_id}` : `/contacts/${res.data.contact_id}`);
    },
    onError: (e) => toast.error(e),
  });
  return (
    <Modal open={open} onClose={onClose} title="Convert lead" size="lg"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={ArrowRightLeft} loading={convert.isPending} onClick={() => convert.mutate()}>Convert</Button></>}>
      <div className="stack">
        {dups.data?.contacts?.length > 0 && (
          <Alert tone="warning">
            A contact with this email already exists. Link the lead to it instead of creating a duplicate:
            <div className="row tight" style={{ marginTop: 8 }}>
              {dups.data.contacts.map((c) => <Button key={c.id} size="sm" variant={contactId === c.id ? 'primary' : 'default'} onClick={() => setContactId(contactId === c.id ? '' : c.id)}>{fullName(c)}</Button>)}
            </div>
          </Alert>
        )}
        <Card title="Contact"><span className="small">{contactId ? 'The lead will be merged into the selected existing contact.' : `A new contact “${fullName(lead)}” will be created with the lead's details, activities and files.`}</span></Card>
        <Card title="Account">
          <div className="stack">
            <Checkbox label={lead.company ? `Create account “${lead.company}”` : 'Create an account'} checked={createAccount && !accountId} disabled={!!accountId} onChange={(e) => setCreateAccount(e.target.checked)} />
            <div className="field"><span className="label">Or attach to an existing account</span><LookupSelect entity="account" value={accountId} onChange={setAccountId} aria-label="Existing account" /></div>
          </div>
        </Card>
        <Card title="Opportunity">
          <div className="stack">
            <Checkbox label="Create an opportunity" checked={createOpp} onChange={(e) => setCreateOpp(e.target.checked)} />
            {createOpp && <div className="form-grid">
              <TextField className="full" label="Deal name" value={opp.name} onChange={(e) => setOpp({ ...opp, name: e.target.value })} />
              <TextField label="Amount" type="number" value={opp.amount} onChange={(e) => setOpp({ ...opp, amount: e.target.value })} />
              <TextField label="Expected close" type="date" value={opp.expected_close_date} onChange={(e) => setOpp({ ...opp, expected_close_date: e.target.value })} />
            </div>}
          </div>
        </Card>
      </div>
    </Modal>
  );
}

export function LeadDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [converting, setConverting] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const lead = useQuery({ queryKey: ['leads', id], queryFn: () => get(`/leads/${id}`).then((r) => r.data) });
  const dups = useQuery({ queryKey: ['lead-dup-banner', id], queryFn: () => get('/leads/duplicates', { email: lead.data.email, exclude_id: id }).then((r) => r.data), enabled: !!lead.data?.email && lead.data?.status !== 'converted' });
  return (
    <>
      {dups.data && (dups.data.leads.length > 0 || dups.data.contacts.length > 0) && (
        <div style={{ marginBottom: 12 }}><Alert tone="warning">Possible duplicates: {[...dups.data.leads.map((l) => <Link key={l.id} to={`/leads/${l.id}`}>{fullName(l)} (lead)</Link>), ...dups.data.contacts.map((c) => <Link key={c.id} to={`/contacts/${c.id}`}>{fullName(c)} (contact)</Link>)].reduce((acc, el, i) => (i ? [...acc, ', ', el] : [el]), [])}</Alert></div>
      )}
      <RecordPage entityType="lead" id={id}
        headerExtra={(r) => <><Badge value={r.status} />{r.rating && <Badge value={r.rating} />}</>}
        composerLinks={(r) => ({ lead_id: r.id })}
        actions={(r) => <>
          {r.email && can('communications:create') && <Button icon={Mail} onClick={() => setEmailing(true)}>Email</Button>}
          {r.status !== 'converted' && can('leads:convert') && <Button variant="primary" icon={ArrowRightLeft} onClick={() => setConverting(true)}>Convert</Button>}
        </>}
        details={(r) => (
          <Card title="Lead details">
            {r.status === 'converted' && <div style={{ marginBottom: 12 }}><Alert tone="success">Converted {dateTime(r.converted_at)}. {r.converted_contact_id && <Link to={`/contacts/${r.converted_contact_id}`}>Contact</Link>}{r.converted_opportunity_id && <> · <Link to={`/opportunities/${r.converted_opportunity_id}`}>Opportunity</Link></>}</Alert></div>}
            <DescriptionList items={[
              ['Score', <strong key="s">{r.score}</strong>], ['Email', r.email && <a href={`mailto:${r.email}`}>{r.email}</a>], ['Phone', r.phone], ['Company', r.company], ['Title', r.title],
              ['Source', r.source?.replace(/_/g, ' ')], ['Campaign', r.campaign && <Link to={`/campaigns/${r.campaign.id}`}>{r.campaign.name}</Link>], ['Industry', r.industry],
              ['Revenue', r.annual_revenue && money(r.annual_revenue)], ['Next follow-up', dateTime(r.next_follow_up_at)], ['Owner', r.owner?.name],
              ['Email opt-out', r.email_opt_out ? 'Yes' : 'No'], ['Created', dateTime(r.created_at)],
            ]} />
          </Card>
        )} />
      {lead.data && converting && <ConvertModal lead={lead.data} open onClose={() => setConverting(false)} />}
      {emailing && <EmailComposer open onClose={() => setEmailing(false)} recipient={{ lead_id: id }} />}
    </>
  );
}

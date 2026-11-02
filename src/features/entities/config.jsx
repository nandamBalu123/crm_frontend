import { Link } from 'react-router';
import { Badge, Avatar } from '../../components/ui';
import { money, date, dateTime, fullName, relative } from '../../utils/format';

const owner = { key: 'owner', label: 'Owner', render: (r) => (r.owner ? <span className="row tight"><Avatar name={r.owner.name} /> {r.owner.name}</span> : <span className="subtle">Unassigned</span>) };
const created = { key: 'created_at', label: 'Created', sortable: true, render: (r) => <span title={dateTime(r.created_at)}>{relative(r.created_at)}</span> };
const ADDRESS = [
  { key: 'address_line1', label: 'Address', full: true, section: 'Address' }, { key: 'city', label: 'City' }, { key: 'state', label: 'State / region' },
  { key: 'postal_code', label: 'Postal code' }, { key: 'country', label: 'Country' },
];
const OPT = (arr) => arr.map((v) => ({ value: v, label: v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }));

/**
 * UI configuration per CRM entity. The backend remains the source of truth
 * for validation, permissions and field visibility.
 */
export const ENTITIES = {
  lead: {
    type: 'lead', route: 'leads', module: 'leads', label: 'Lead', plural: 'Leads',
    title: (r) => fullName(r), subtitle: (r) => [r.title, r.company].filter(Boolean).join(' · '),
    defaultSort: '-created_at',
    columns: [
      { key: 'last_name', label: 'Name', sortable: true, render: (r) => <Link to={`/leads/${r.id}`}><strong>{fullName(r)}</strong></Link> },
      { key: 'company', label: 'Company', sortable: true },
      { key: 'email', label: 'Email' },
      { key: 'status', label: 'Status', sortable: true, render: (r) => <Badge value={r.status} /> },
      { key: 'rating', label: 'Rating', render: (r) => (r.rating ? <Badge value={r.rating} /> : null) },
      { key: 'score', label: 'Score', sortable: true, align: 'right' },
      { key: 'source', label: 'Source', render: (r) => r.source?.replace(/_/g, ' ') },
      owner, created,
    ],
    filters: [
      { key: 'status', label: 'Status', type: 'select', options: OPT(['new', 'contacted', 'nurturing', 'qualified', 'unqualified', 'converted']) },
      { key: 'rating', label: 'Rating', type: 'select', options: OPT(['hot', 'warm', 'cold']) },
      { key: 'source', label: 'Source', type: 'pref', pref: 'lead_sources' },
      { key: 'owner_id', label: 'Owner', type: 'owner' },
      { key: 'score', label: 'Min score', type: 'number', op: 'gte' },
    ],
    fields: [
      { key: 'first_name', label: 'First name' }, { key: 'last_name', label: 'Last name', required: true },
      { key: 'email', label: 'Email', type: 'email' }, { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'company', label: 'Company' }, { key: 'title', label: 'Job title' },
      { key: 'website', label: 'Website', type: 'url' }, { key: 'industry', label: 'Industry', type: 'pref', pref: 'industries' },
      { key: 'status', label: 'Status', type: 'select', options: OPT(['new', 'contacted', 'nurturing', 'qualified', 'unqualified']) },
      { key: 'rating', label: 'Rating', type: 'select', options: OPT(['hot', 'warm', 'cold']) },
      { key: 'source', label: 'Source', type: 'pref', pref: 'lead_sources' }, { key: 'owner_id', label: 'Owner', type: 'owner' },
      { key: 'employees', label: 'Employees', type: 'number' }, { key: 'annual_revenue', label: 'Annual revenue', type: 'number' },
      { key: 'next_follow_up_at', label: 'Next follow-up', type: 'datetime' }, { key: 'email_opt_out', label: 'Email opt-out', type: 'checkbox' },
      ...ADDRESS, { key: 'description', label: 'Description', type: 'textarea', full: true },
    ],
  },
  contact: {
    type: 'contact', route: 'contacts', module: 'contacts', label: 'Contact', plural: 'Contacts',
    title: (r) => fullName(r), subtitle: (r) => [r.title, r.account?.name].filter(Boolean).join(' · '), defaultSort: 'last_name',
    columns: [
      { key: 'last_name', label: 'Name', sortable: true, render: (r) => <Link to={`/contacts/${r.id}`}><strong>{fullName(r)}</strong></Link> },
      { key: 'account', label: 'Account', render: (r) => (r.account ? <Link to={`/accounts/${r.account.id}`}>{r.account.name}</Link> : null) },
      { key: 'title', label: 'Title', sortable: true }, { key: 'email', label: 'Email', sortable: true }, { key: 'phone', label: 'Phone' },
      owner, { key: 'last_activity_at', label: 'Last activity', sortable: true, render: (r) => relative(r.last_activity_at) },
    ],
    filters: [{ key: 'owner_id', label: 'Owner', type: 'owner' }, { key: 'lead_source', label: 'Source', type: 'pref', pref: 'lead_sources' }, { key: 'country', label: 'Country', type: 'text' }],
    fields: [
      { key: 'first_name', label: 'First name', required: true }, { key: 'last_name', label: 'Last name' },
      { key: 'email', label: 'Email', type: 'email' }, { key: 'phone', label: 'Phone', type: 'tel' }, { key: 'mobile', label: 'Mobile', type: 'tel' },
      { key: 'title', label: 'Job title' }, { key: 'department', label: 'Department' }, { key: 'account_id', label: 'Account', type: 'lookup', lookup: 'account' },
      { key: 'lead_source', label: 'Source', type: 'pref', pref: 'lead_sources' }, { key: 'owner_id', label: 'Owner', type: 'owner' },
      { key: 'linkedin_url', label: 'LinkedIn URL', type: 'url' },
      { key: 'email_opt_out', label: 'Email opt-out', type: 'checkbox' }, { key: 'sms_opt_out', label: 'SMS opt-out', type: 'checkbox' }, { key: 'do_not_call', label: 'Do not call', type: 'checkbox' },
      ...ADDRESS, { key: 'description', label: 'Notes', type: 'textarea', full: true },
    ],
  },
  account: {
    type: 'account', route: 'accounts', module: 'accounts', label: 'Account', plural: 'Accounts',
    title: (r) => r.name, subtitle: (r) => [r.industry, r.domain].filter(Boolean).join(' · '), defaultSort: 'name',
    columns: [
      { key: 'name', label: 'Name', sortable: true, render: (r) => <Link to={`/accounts/${r.id}`}><strong>{r.name}</strong></Link> },
      { key: 'type', label: 'Type', sortable: true, render: (r) => <Badge value={r.type} /> }, { key: 'industry', label: 'Industry', sortable: true },
      { key: 'domain', label: 'Domain' }, { key: 'annual_revenue', label: 'Revenue', sortable: true, align: 'right', render: (r) => (r.annual_revenue ? money(r.annual_revenue) : null) },
      { key: 'employees', label: 'Employees', sortable: true, align: 'right' }, owner,
    ],
    filters: [{ key: 'type', label: 'Type', type: 'select', options: OPT(['prospect', 'customer', 'partner', 'vendor', 'other']) }, { key: 'industry', label: 'Industry', type: 'pref', pref: 'industries' }, { key: 'owner_id', label: 'Owner', type: 'owner' }],
    fields: [
      { key: 'name', label: 'Account name', required: true }, { key: 'type', label: 'Type', type: 'select', options: OPT(['prospect', 'customer', 'partner', 'vendor', 'other']) },
      { key: 'website', label: 'Website', type: 'url' }, { key: 'domain', label: 'Domain' }, { key: 'industry', label: 'Industry', type: 'pref', pref: 'industries' },
      { key: 'employees', label: 'Employees', type: 'number' }, { key: 'annual_revenue', label: 'Annual revenue', type: 'number' },
      { key: 'phone', label: 'Phone', type: 'tel' }, { key: 'email', label: 'Email', type: 'email' },
      { key: 'parent_account_id', label: 'Parent account', type: 'lookup', lookup: 'account' }, { key: 'owner_id', label: 'Owner', type: 'owner' },
      ...ADDRESS, { key: 'description', label: 'Description', type: 'textarea', full: true },
    ],
  },
  opportunity: {
    type: 'opportunity', route: 'opportunities', module: 'opportunities', label: 'Opportunity', plural: 'Opportunities',
    title: (r) => r.name, subtitle: (r) => r.account?.name, defaultSort: 'expected_close_date',
    columns: [
      { key: 'name', label: 'Deal', sortable: true, render: (r) => <Link to={`/opportunities/${r.id}`}><strong>{r.name}</strong></Link> },
      { key: 'account', label: 'Account', render: (r) => r.account?.name },
      { key: 'stage', label: 'Stage', render: (r) => <Badge value={r.status} tone={r.status === 'open' ? 'info' : undefined}>{r.stage?.name}</Badge> },
      { key: 'amount', label: 'Amount', sortable: true, align: 'right', render: (r) => (r.amount !== undefined ? money(r.amount, r.currency) : <span className="subtle">Restricted</span>) },
      { key: 'probability', label: 'Prob.', sortable: true, align: 'right', render: (r) => (r.probability !== undefined ? `${r.probability}%` : '—') },
      { key: 'expected_close_date', label: 'Close date', sortable: true, render: (r) => date(r.expected_close_date) }, owner,
    ],
    filters: [{ key: 'status', label: 'Status', type: 'select', options: OPT(['open', 'won', 'lost']) }, { key: 'owner_id', label: 'Owner', type: 'owner' }, { key: 'forecast_category', label: 'Forecast', type: 'select', options: OPT(['pipeline', 'best_case', 'commit', 'closed', 'omitted']) }, { key: 'amount', label: 'Min amount', type: 'number', op: 'gte' }],
    fields: [
      { key: 'name', label: 'Deal name', required: true, full: true }, { key: 'account_id', label: 'Account', type: 'lookup', lookup: 'account' }, { key: 'contact_id', label: 'Primary contact', type: 'lookup', lookup: 'contact' },
      { key: 'amount', label: 'Amount', type: 'number' }, { key: 'currency', label: 'Currency' }, { key: 'expected_close_date', label: 'Expected close', type: 'date' },
      { key: 'probability', label: 'Probability %', type: 'number' }, { key: 'forecast_category', label: 'Forecast category', type: 'select', options: OPT(['pipeline', 'best_case', 'commit', 'closed', 'omitted']) },
      { key: 'next_step', label: 'Next step', full: true }, { key: 'owner_id', label: 'Owner', type: 'owner' },
      { key: 'description', label: 'Description', type: 'textarea', full: true },
    ],
  },
  activity: {
    type: 'activity', route: 'activities', module: 'activities', label: 'Activity', plural: 'Activities', title: (r) => r.subject, defaultSort: 'due_at',
    columns: [
      { key: 'subject', label: 'Subject', sortable: false, render: (r) => <strong className={r.status === 'completed' ? 'muted' : ''} style={{ textDecoration: r.status === 'completed' ? 'line-through' : undefined }}>{r.subject}</strong> },
      { key: 'type', label: 'Type', render: (r) => <Badge>{r.type}</Badge> },
      { key: 'related', label: 'Related to', render: (r) => (r.contact ? <Link to={`/contacts/${r.contact.id}`}>{fullName(r.contact)}</Link> : r.lead ? <Link to={`/leads/${r.lead.id}`}>{fullName(r.lead)}</Link> : r.opportunity ? <Link to={`/opportunities/${r.opportunity.id}`}>{r.opportunity.name}</Link> : r.account ? <Link to={`/accounts/${r.account.id}`}>{r.account.name}</Link> : null) },
      { key: 'due_at', label: 'Due', sortable: true, render: (r) => <span className={r.is_overdue ? 'badge danger' : ''}>{dateTime(r.due_at || r.start_at)}</span> },
      { key: 'priority', label: 'Priority', sortable: true, render: (r) => <Badge value={r.priority} /> },
      { key: 'status', label: 'Status', sortable: true, render: (r) => <Badge value={r.status} /> }, owner,
    ],
    filters: [{ key: 'type', label: 'Type', type: 'select', options: OPT(['task', 'call', 'meeting', 'note', 'email']) }, { key: 'status', label: 'Status', type: 'select', options: OPT(['open', 'completed', 'canceled']) }, { key: 'owner_id', label: 'Assignee', type: 'owner' }, { key: 'priority', label: 'Priority', type: 'select', options: OPT(['low', 'normal', 'high']) }],
    fields: [
      { key: 'type', label: 'Type', type: 'select', options: OPT(['task', 'call', 'meeting', 'note']), required: true }, { key: 'subject', label: 'Subject', required: true },
      { key: 'due_at', label: 'Due', type: 'datetime' }, { key: 'priority', label: 'Priority', type: 'select', options: OPT(['low', 'normal', 'high']) },
      { key: 'start_at', label: 'Starts', type: 'datetime' }, { key: 'end_at', label: 'Ends', type: 'datetime' },
      { key: 'reminder_at', label: 'Reminder', type: 'datetime' }, { key: 'owner_id', label: 'Assignee', type: 'owner' },
      { key: 'location', label: 'Location' }, { key: 'call_outcome', label: 'Call outcome' },
      { key: 'description', label: 'Details', type: 'textarea', full: true },
    ],
  },
  ticket: {
    type: 'ticket', route: 'tickets', module: 'tickets', label: 'Ticket', plural: 'Tickets', title: (r) => `#${r.number} ${r.subject}`, defaultSort: '-created_at',
    columns: [
      { key: 'number', label: '#', sortable: true, width: 70, render: (r) => <Link to={`/tickets/${r.id}`}>#{r.number}</Link> },
      { key: 'subject', label: 'Subject', render: (r) => <Link to={`/tickets/${r.id}`}><strong>{r.subject}</strong></Link> },
      { key: 'contact', label: 'Requester', render: (r) => (r.contact ? fullName(r.contact) : null) },
      { key: 'priority', label: 'Priority', sortable: true, render: (r) => <Badge value={r.priority} /> },
      { key: 'status', label: 'Status', sortable: true, render: (r) => <Badge value={r.status} /> },
      { key: 'sla_status', label: 'SLA', render: (r) => <Badge value={r.sla_status} /> },
      { key: 'resolution_due_at', label: 'Resolve by', sortable: true, render: (r) => dateTime(r.resolution_due_at) }, owner,
    ],
    filters: [{ key: 'status', label: 'Status', type: 'select', options: OPT(['new', 'open', 'pending', 'on_hold', 'resolved', 'closed']) }, { key: 'priority', label: 'Priority', type: 'select', options: OPT(['low', 'normal', 'high', 'urgent']) }, { key: 'owner_id', label: 'Assignee', type: 'owner' }, { key: 'sla_breached', label: 'SLA breached', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] }],
    fields: [
      { key: 'subject', label: 'Subject', required: true, full: true }, { key: 'contact_id', label: 'Requester (contact)', type: 'lookup', lookup: 'contact' },
      { key: 'priority', label: 'Priority', type: 'select', options: OPT(['low', 'normal', 'high', 'urgent']) }, { key: 'channel', label: 'Channel', type: 'select', options: OPT(['email', 'phone', 'web', 'chat', 'other']) },
      { key: 'status', label: 'Status', type: 'select', options: OPT(['new', 'open', 'pending', 'on_hold', 'resolved', 'closed']) }, { key: 'owner_id', label: 'Assignee', type: 'owner' },
      { key: 'description', label: 'Description', type: 'textarea', full: true },
    ],
  },
  product: {
    type: 'product', route: 'products', module: 'products', label: 'Product', plural: 'Products', title: (r) => r.name, defaultSort: 'name',
    columns: [
      { key: 'sku', label: 'SKU', sortable: true, render: (r) => <span className="mono">{r.sku}</span> }, { key: 'name', label: 'Name', sortable: true, render: (r) => <strong>{r.name}</strong> },
      { key: 'category', label: 'Category', render: (r) => r.category?.name }, { key: 'unit_price', label: 'Price', sortable: true, align: 'right', render: (r) => money(r.unit_price, r.currency) },
      { key: 'tax_rate', label: 'Tax %', align: 'right', render: (r) => Number(r.tax_rate) }, { key: 'is_active', label: 'Status', render: (r) => <Badge value={r.is_active ? 'active' : 'disabled'} /> },
    ],
    filters: [{ key: 'is_active', label: 'Active', type: 'select', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] }],
    fields: [
      { key: 'sku', label: 'SKU', required: true }, { key: 'name', label: 'Name', required: true }, { key: 'unit_price', label: 'Unit price', type: 'number', required: true },
      { key: 'currency', label: 'Currency' }, { key: 'tax_rate', label: 'Tax rate %', type: 'number' }, { key: 'unit', label: 'Unit' },
      { key: 'max_discount_percent', label: 'Max discount % (without approval)', type: 'number' }, { key: 'is_active', label: 'Active', type: 'checkbox' },
      { key: 'description', label: 'Description', type: 'textarea', full: true },
    ],
  },
  campaign: {
    type: 'campaign', route: 'campaigns', module: 'campaigns', label: 'Campaign', plural: 'Campaigns', title: (r) => r.name, defaultSort: '-created_at',
    columns: [
      { key: 'name', label: 'Campaign', sortable: true, render: (r) => <Link to={`/campaigns/${r.id}`}><strong>{r.name}</strong></Link> },
      { key: 'type', label: 'Type', render: (r) => <Badge>{r.type}</Badge> }, { key: 'status', label: 'Status', sortable: true, render: (r) => <Badge value={r.status} /> },
      { key: 'start_date', label: 'Start', sortable: true, render: (r) => date(r.start_date) }, { key: 'end_date', label: 'End', sortable: true, render: (r) => date(r.end_date) },
      { key: 'budget', label: 'Budget', align: 'right', render: (r) => money(r.budget, r.currency) }, owner,
    ],
    filters: [{ key: 'status', label: 'Status', type: 'select', options: OPT(['planned', 'active', 'completed', 'aborted']) }, { key: 'type', label: 'Type', type: 'select', options: OPT(['email', 'event', 'webinar', 'advertising', 'social', 'referral', 'other']) }],
    fields: [
      { key: 'name', label: 'Name', required: true, full: true }, { key: 'type', label: 'Type', type: 'select', options: OPT(['email', 'event', 'webinar', 'advertising', 'social', 'referral', 'other']) },
      { key: 'status', label: 'Status', type: 'select', options: OPT(['planned', 'active', 'completed', 'aborted']) }, { key: 'start_date', label: 'Start date', type: 'date' }, { key: 'end_date', label: 'End date', type: 'date' },
      { key: 'budget', label: 'Budget', type: 'number' }, { key: 'actual_cost', label: 'Actual cost', type: 'number' }, { key: 'expected_revenue', label: 'Expected revenue', type: 'number' }, { key: 'source', label: 'Source' },
      { key: 'owner_id', label: 'Owner', type: 'owner' }, { key: 'description', label: 'Description', type: 'textarea', full: true },
    ],
  },
};

export const byRoute = Object.fromEntries(Object.values(ENTITIES).map((e) => [e.route, e]));

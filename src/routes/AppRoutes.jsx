import { lazy, Suspense } from 'react';
import { Route, Routes, useParams } from 'react-router';
import { AppShell } from '../layouts/AppShell';
import { RequireAuth, RequirePermission, RedirectIfAuthed, FullPageSpinner } from './guards';
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage, AcceptInvitePage } from '../features/auth/AuthPages';
import { PublicFormPage, UnsubscribePage } from '../features/public/PublicPages';
import { EntityListPage } from '../features/entities/EntityListPage';
import { ErrorState } from '../components/ui';

const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ReportsPage = lazy(() => import('../features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const LeadDetailPage = lazy(() => import('../features/leads/LeadDetailPage').then((m) => ({ default: m.LeadDetailPage })));
const ContactDetailPage = lazy(() => import('../features/contacts/ContactDetailPage').then((m) => ({ default: m.ContactDetailPage })));
const AccountDetailPage = lazy(() => import('../features/accounts/AccountDetailPage').then((m) => ({ default: m.AccountDetailPage })));
const OpportunityDetailPage = lazy(() => import('../features/opportunities/OpportunityDetailPage').then((m) => ({ default: m.OpportunityDetailPage })));
const PipelineBoardPage = lazy(() => import('../features/opportunities/PipelineBoardPage').then((m) => ({ default: m.PipelineBoardPage })));
const ActivitiesPage = lazy(() => import('../features/activities/ActivitiesPage').then((m) => ({ default: m.ActivitiesPage })));
const TicketDetailPage = lazy(() => import('../features/tickets/TicketDetailPage').then((m) => ({ default: m.TicketDetailPage })));
const QuotesPage = lazy(() => import('../features/quotes/QuotesPage').then((m) => ({ default: m.QuotesPage })));
const QuoteDetailPage = lazy(() => import('../features/quotes/QuoteDetailPage').then((m) => ({ default: m.QuoteDetailPage })));
const MarketingPage = lazy(() => import('../features/campaigns/CampaignPages').then((m) => ({ default: m.MarketingPage })));
const CampaignDetailPage = lazy(() => import('../features/campaigns/CampaignPages').then((m) => ({ default: m.CampaignDetailPage })));
const ProfilePage = lazy(() => import('../features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const PlatformPage = lazy(() => import('../features/platform/PlatformPage').then((m) => ({ default: m.PlatformPage })));
const Settings = lazy(() => import('./SettingsRoutes'));
const ImportsList = lazy(() => import('../features/imports/ImportPages').then((m) => ({ default: m.ImportsPage })));
const ImportWizard = lazy(() => import('../features/imports/ImportPages').then((m) => ({ default: m.ImportWizardPage })));
const ImportStatus = lazy(() => import('../features/imports/ImportPages').then((m) => ({ default: m.ImportStatusPage })));

const P = ({ perm, children }) => <RequirePermission perm={perm}>{children}</RequirePermission>;
function Keyed({ children }) {
  const { id } = useParams();
  return <div key={id}>{children}</div>;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
        <Route path="/register" element={<RedirectIfAuthed><RegisterPage /></RedirectIfAuthed>} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        <Route path="/f/:key" element={<PublicFormPage />} />
        <Route path="/unsubscribe" element={<UnsubscribePage />} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<P perm="dashboard:read"><DashboardPage /></P>} />
          <Route path="leads" element={<P perm="leads:read"><EntityListPage entityType="lead" /></P>} />
          <Route path="leads/:id" element={<P perm="leads:read"><Keyed><LeadDetailPage /></Keyed></P>} />
          <Route path="contacts" element={<P perm="contacts:read"><EntityListPage entityType="contact" /></P>} />
          <Route path="contacts/:id" element={<P perm="contacts:read"><Keyed><ContactDetailPage /></Keyed></P>} />
          <Route path="accounts" element={<P perm="accounts:read"><EntityListPage entityType="account" /></P>} />
          <Route path="accounts/:id" element={<P perm="accounts:read"><Keyed><AccountDetailPage /></Keyed></P>} />
          <Route path="opportunities" element={<P perm="opportunities:read"><EntityListPage entityType="opportunity" /></P>} />
          <Route path="opportunities/:id" element={<P perm="opportunities:read"><Keyed><OpportunityDetailPage /></Keyed></P>} />
          <Route path="pipeline" element={<P perm="opportunities:read"><PipelineBoardPage /></P>} />
          <Route path="activities" element={<P perm="activities:read"><ActivitiesPage /></P>} />
          <Route path="tickets" element={<P perm="tickets:read"><EntityListPage entityType="ticket" /></P>} />
          <Route path="tickets/:id" element={<P perm="tickets:read"><Keyed><TicketDetailPage /></Keyed></P>} />
          <Route path="products" element={<P perm="products:read"><EntityListPage entityType="product" rowLink={false} /></P>} />
          <Route path="quotes" element={<P perm="quotes:read"><QuotesPage /></P>} />
          <Route path="quotes/:id" element={<P perm="quotes:read"><Keyed><QuoteDetailPage /></Keyed></P>} />
          <Route path="campaigns" element={<P perm="campaigns:read"><MarketingPage /></P>} />
          <Route path="campaigns/:id" element={<P perm="campaigns:read"><Keyed><CampaignDetailPage /></Keyed></P>} />
          <Route path="reports" element={<P perm="reports:read"><ReportsPage /></P>} />
          <Route path="imports" element={<ImportsList />} />
          <Route path="imports/new" element={<ImportWizard />} />
          <Route path="imports/:id" element={<ImportStatus />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings/*" element={<Settings />} />
          <Route path="platform" element={<PlatformPage />} />
          <Route path="*" element={<ErrorState error={{ status: 404, message: 'This page does not exist.' }} />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

import { Route, Routes } from 'react-router';
import { SettingsLayout, SettingsIndex } from '../features/settings/SettingsLayout';
import { GeneralSettings, BrandingSettings, SecuritySettings, BillingSettings } from '../features/settings/GeneralSettings';
import { UsersSettings, TeamsSettings } from '../features/settings/PeopleSettings';
import { RolesSettings } from '../features/settings/RolesSettings';
import { CustomFieldsSettings, PipelinesSettings } from '../features/settings/CustomizeSettings';
import { WorkflowsSettings } from '../features/settings/WorkflowsSettings';
import { IntegrationsSettings, ApiKeysSettings, WebhooksSettings } from '../features/settings/ConnectSettings';
import { TemplatesSettings, SupportSettings, AuditSettings } from '../features/settings/OtherSettings';
import { RequirePermission } from './guards';

const P = ({ perm, children }) => <RequirePermission perm={perm}>{children}</RequirePermission>;

export default function SettingsRoutes() {
  return (
    <Routes>
      <Route element={<SettingsLayout />}>
        <Route index element={<SettingsIndex />} />
        <Route path="general" element={<P perm="settings:read"><GeneralSettings /></P>} />
        <Route path="branding" element={<P perm="settings:read"><BrandingSettings /></P>} />
        <Route path="security" element={<P perm="settings:read"><SecuritySettings /></P>} />
        <Route path="billing" element={<P perm="billing:read"><BillingSettings /></P>} />
        <Route path="users" element={<P perm="users:read"><UsersSettings /></P>} />
        <Route path="teams" element={<P perm="users:read"><TeamsSettings /></P>} />
        <Route path="roles" element={<P perm="roles:read"><RolesSettings /></P>} />
        <Route path="custom-fields" element={<P perm="custom_fields:manage"><CustomFieldsSettings /></P>} />
        <Route path="pipelines" element={<P perm="settings:manage"><PipelinesSettings /></P>} />
        <Route path="workflows" element={<P perm="workflows:read"><WorkflowsSettings /></P>} />
        <Route path="workflows/:id" element={<P perm="workflows:read"><WorkflowsSettings /></P>} />
        <Route path="templates" element={<P perm="communications:read"><TemplatesSettings /></P>} />
        <Route path="support" element={<P perm="tickets:read"><SupportSettings /></P>} />
        <Route path="integrations" element={<P perm="integrations:read"><IntegrationsSettings /></P>} />
        <Route path="api-keys" element={<P perm="api_keys:manage"><ApiKeysSettings /></P>} />
        <Route path="webhooks" element={<P perm="webhooks:manage"><WebhooksSettings /></P>} />
        <Route path="audit" element={<P perm="audit:read"><AuditSettings /></P>} />
      </Route>
    </Routes>
  );
}

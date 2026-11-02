import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { SettingsLayout } from '../features/settings/SettingsLayout';

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ can: () => true }) }));

// Settings is mounted under a splat route ("settings/*"); relative links there resolve
// against the current sub-page (/settings/general/users), so they must stay absolute.
function SettingsSplat() {
  return (
    <Routes>
      <Route element={<SettingsLayout />}>
        <Route path="general" element={<p>General page</p>} />
      </Route>
    </Routes>
  );
}

it('settings navigation links point at /settings/<page> from any settings page', () => {
  render(
    <MemoryRouter initialEntries={['/settings/general']}>
      <Routes><Route path="settings/*" element={<SettingsSplat />} /></Routes>
    </MemoryRouter>
  );
  expect(screen.getByText('General page')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/settings/users');
  expect(screen.getByRole('link', { name: 'Audit log' })).toHaveAttribute('href', '/settings/audit');
});

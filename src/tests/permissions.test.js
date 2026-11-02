import { can, canAny, fieldAccess, moduleEnabled } from '../permissions/can';

const me = { permissions: { 'leads:read': 'own', 'leads:update': 'all' }, field_access: { opportunity: { amount: 'hidden' } }, plan: { features: ['leads'] }, tenant: { settings: { modules: { leads: true, tickets: false } } } };

test('scope-aware permission checks', () => {
  expect(can(me, 'leads:read')).toBe(true);
  expect(can(me, 'leads:read', 'team')).toBe(false);
  expect(can(me, 'leads:update', 'team')).toBe(true);
  expect(can(me, 'leads:delete')).toBe(false);
  expect(can(null, 'leads:read')).toBe(false);
  expect(canAny(me, ['x:y', 'leads:read'])).toBe(true);
});

test('field access defaults to write and respects restrictions', () => {
  expect(fieldAccess(me, 'opportunity', 'amount')).toBe('hidden');
  expect(fieldAccess(me, 'opportunity', 'name')).toBe('write');
});

test('module entitlement requires plan feature and tenant toggle', () => {
  expect(moduleEnabled(me, 'leads')).toBe(true);
  expect(moduleEnabled(me, 'tickets')).toBe(false);
  expect(moduleEnabled(me, 'quotes')).toBe(false);
});

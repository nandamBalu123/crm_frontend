import { buildPayload } from '../features/entities/EntityForm';
import { passwordProblems } from '../validators/auth';

test('buildPayload sends only changed fields and normalises empty strings', () => {
  const original = { name: 'A', email: 'a@x.test', phone: null, custom_fields: { tier: 'gold', seats: '5' } };
  const values = { name: 'A', email: '', phone: null, custom_fields: { tier: 'gold', seats: '7' } };
  expect(buildPayload(values, original)).toEqual({ email: null, custom_fields: { seats: '7' } });
});

test('buildPayload without original sends everything', () => {
  expect(buildPayload({ name: 'B', custom_fields: { x: '' } })).toEqual({ name: 'B', custom_fields: { x: null } });
});

test('client password feedback', () => {
  expect(passwordProblems('short')).toHaveLength(1);
  expect(passwordProblems('long-enough-pass')).toHaveLength(0);
  expect(passwordProblems('me@example.test', 'me@example.test')).toContain('Password must not be your email');
});

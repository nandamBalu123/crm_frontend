import { api, ApiError, onSessionExpired } from '../api/client';

function mockAdapter(responses) {
  const calls = [];
  api.defaults.adapter = async (config) => {
    calls.push(config);
    const r = responses.shift();
    if (r.status >= 400) {
      const err = new Error('fail');
      err.config = config;
      err.response = { status: r.status, data: r.data, headers: {}, config };
      throw err;
    }
    return { status: r.status, data: r.data, headers: {}, config, statusText: 'OK' };
  };
  return calls;
}

test('unsafe requests carry the CSRF token from the cookie; safe ones do not', async () => {
  document.cookie = 'crm_csrf=abc123';
  const calls = mockAdapter([{ status: 200, data: { data: 1 } }, { status: 200, data: { data: 2 } }]);
  await api.post('/leads', {});
  await api.get('/leads');
  expect(calls[0].headers['X-CSRF-Token']).toBe('abc123');
  expect(calls[1].headers['X-CSRF-Token']).toBeUndefined();
});

test('errors are normalised to ApiError with field errors', async () => {
  mockAdapter([{ status: 422, data: { error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: [{ path: 'body.email', message: 'Bad' }], request_id: 'r1' } } }]);
  const err = await api.post('/leads', {}).catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err.code).toBe('VALIDATION_ERROR');
  expect(err.fieldErrors()).toEqual({ email: 'Bad' });
  expect(err.requestId).toBe('r1');
});

test('revoked sessions notify listeners', async () => {
  const fn = vi.fn();
  const off = onSessionExpired(fn);
  mockAdapter([{ status: 401, data: { error: { code: 'SESSION_REVOKED', message: 'x' } } }]);
  await api.get('/auth/me').catch(() => {});
  expect(fn).toHaveBeenCalled();
  off();
});

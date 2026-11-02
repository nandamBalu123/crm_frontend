import { errorText } from '../context/ToastContext';
import { ApiError } from '../api/client';

describe('errorText', () => {
  it('passes plain strings through', () => {
    expect(errorText('Saved')).toBe('Saved');
  });

  it('lists field messages so users know what to fix', () => {
    const err = new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'Validation failed', details: [{ path: 'name', message: 'Required' }, { path: 'body.from_email', message: 'Invalid email address' }] });
    expect(errorText(err)).toBe('Validation failed: name — Required; from email — Invalid email address');
  });

  it('falls back to the message without details', () => {
    expect(errorText(new ApiError({ status: 409, message: 'Conflict' }))).toBe('Conflict');
    expect(errorText(undefined)).toBe('Something went wrong');
  });
});

import { z } from 'zod';

// Client-side checks for fast feedback only; the server enforces the real policy.
export const emailSchema = z.string().trim().email('Enter a valid email');

export function passwordProblems(password, email = '') {
  const problems = [];
  if (!password || password.length < 10) problems.push('Use at least 10 characters');
  if (password && password.length > 128) problems.push('Use at most 128 characters');
  if (password && email && password.toLowerCase() === email.toLowerCase()) problems.push('Password must not be your email');
  return problems;
}

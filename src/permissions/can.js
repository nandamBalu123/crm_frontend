/**
 * Client-side permission helpers drive what the UI SHOWS. They are a UX
 * convenience only — the backend enforces every permission on every request.
 */
const RANK = { own: 1, team: 2, all: 3 };

export function can(me, permission, minScope) {
  const scope = me?.permissions?.[permission];
  if (!scope) return false;
  return !minScope || RANK[scope] >= RANK[minScope];
}
export const canAny = (me, perms) => perms.some((p) => can(me, p));
export function fieldAccess(me, entityType, field) {
  return me?.field_access?.[entityType]?.[field] || 'write';
}
export function moduleEnabled(me, key) {
  const planOk = !me?.plan?.features?.length || me.plan.features.includes(key);
  return planOk && me?.tenant?.settings?.modules?.[key] !== false;
}

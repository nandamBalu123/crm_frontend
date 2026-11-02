import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, onSessionExpired } from '../api/client';
import { configureFormatting } from '../utils/format';
import { can as canFn } from '../permissions/can';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => get('/auth/me').then((r) => r.data).catch((err) => (err.status === 401 ? null : Promise.reject(err))),
    staleTime: 60_000,
    retry: false,
  });
  const me = meQuery.data || null;

  useEffect(() => onSessionExpired(() => qc.setQueryData(['me'], null)), [qc]);
  useEffect(() => {
    if (me?.tenant) {
      configureFormatting(me.tenant.settings);
      const brand = me.tenant.settings?.branding?.primary_color;
      if (brand) document.documentElement.style.setProperty('--brand', brand);
      document.title = `${me.tenant.settings?.branding?.display_name || me.tenant.name} · CRM`;
    }
  }, [me]);

  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ['me'] }), [qc]);
  const logout = useCallback(async () => {
    try {
      await post('/auth/logout');
    } finally {
      qc.clear();
      qc.setQueryData(['me'], null);
      window.location.assign('/login');
    }
  }, [qc]);
  const switchTenant = useCallback(async (tenantId) => {
    await post('/auth/switch-tenant', { tenant_id: tenantId });
    qc.clear();
    window.location.assign('/');
  }, [qc]);

  const value = useMemo(() => ({
    me, loading: meQuery.isLoading, error: meQuery.error, refresh, logout, switchTenant,
    can: (perm, scope) => canFn(me, perm, scope),
  }), [me, meQuery.isLoading, meQuery.error, refresh, logout, switchTenant]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

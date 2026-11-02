import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';

export function useCustomFields(entityType) {
  return useQuery({
    queryKey: ['custom-fields', entityType],
    queryFn: () => get('/custom-fields', { entity_type: entityType }).then((r) => r.data),
    staleTime: 60_000,
    enabled: !!entityType,
  });
}

export function useMembers() {
  return useQuery({ queryKey: ['members'], queryFn: () => get('/users', { status: 'active' }).then((r) => r.data).catch(() => []), staleTime: 120_000 });
}

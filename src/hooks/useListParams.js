import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

/**
 * List state (page, sort, search, filters, custom-field filters, saved view)
 * lives in the URL so views are shareable and survive reloads. The shape
 * maps 1:1 to the API's query grammar: filter[field][op]=value, cf[key][op]=value.
 */
export function useListParams(defaults = {}) {
  const [sp, setSp] = useSearchParams();
  const state = useMemo(() => {
    const filter = {};
    const cf = {};
    for (const [k, v] of sp.entries()) {
      const m = /^(filter|cf)\[([^\]]+)\](?:\[([^\]]+)\])?$/.exec(k);
      if (!m) continue;
      const target = m[1] === 'filter' ? filter : cf;
      if (m[3]) target[m[2]] = { ...(typeof target[m[2]] === 'object' ? target[m[2]] : {}), [m[3]]: v };
      else target[m[2]] = v;
    }
    return {
      page: Number(sp.get('page')) || 1,
      page_size: Number(sp.get('page_size')) || defaults.page_size || 25,
      sort: sp.get('sort') || defaults.sort || '',
      q: sp.get('q') || '',
      view: sp.get('view') || '',
      filter,
      cf,
    };
  }, [sp, defaults.page_size, defaults.sort]);

  const update = useCallback((patch) => {
    const next = { ...state, ...patch };
    if (!('page' in patch)) next.page = 1;
    const params = new URLSearchParams();
    if (next.page > 1) params.set('page', next.page);
    if (next.page_size !== (defaults.page_size || 25)) params.set('page_size', next.page_size);
    if (next.sort) params.set('sort', next.sort);
    if (next.q) params.set('q', next.q);
    if (next.view) params.set('view', next.view);
    for (const [prefix, obj] of [['filter', next.filter], ['cf', next.cf]]) {
      for (const [k, v] of Object.entries(obj || {})) {
        if (v === '' || v === null || v === undefined) continue;
        if (typeof v === 'object') for (const [op, val] of Object.entries(v)) { if (val !== '' && val !== undefined) params.set(`${prefix}[${k}][${op}]`, val); }
        else params.set(`${prefix}[${k}]`, v);
      }
    }
    setSp(params, { replace: true });
  }, [state, setSp, defaults.page_size]);

  const apiParams = useMemo(() => {
    const p = { page: state.page, page_size: state.page_size };
    if (state.sort) p.sort = state.sort;
    if (state.q) p.q = state.q;
    if (state.view) p.view = state.view;
    for (const [prefix, obj] of [['filter', state.filter], ['cf', state.cf]]) {
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'object') for (const [op, val] of Object.entries(v)) p[`${prefix}[${k}][${op}]`] = val;
        else p[`${prefix}[${k}]`] = v;
      }
    }
    return p;
  }, [state]);

  return { state, update, apiParams };
}

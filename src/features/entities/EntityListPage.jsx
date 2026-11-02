import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Columns3, Download, Filter, Plus, Save, Trash2, UserPlus, Upload, X, Search } from 'lucide-react';
import { get, post, del, download } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useListParams } from '../../hooks/useListParams';
import { useCustomFields, useMembers } from '../../hooks/useCustomFields';
import { useDebounce } from '../../hooks/useDebounce';
import { DataTable, Pagination } from '../../components/data/DataTable';
import { formatCustomValue } from '../../components/forms/CustomFieldInput';
import { Button, PageHeader, Select, Input, Drawer, Modal, Dropdown, Checkbox, ConfirmDialog, TextField, EmptyState } from '../../components/ui';
import { EntityForm, buildPayload } from './EntityForm';
import { ENTITIES } from './config';
import { fullName } from '../../utils/format';


function useColumnPrefs(entityType, defaults) {
  const key = `crm.columns.${entityType}`;
  const [cols, setCols] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) || defaults;
    } catch {
      return defaults;
    }
  });
  const save = (next) => {
    setCols(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };
  return [cols, save];
}

export function CreateDrawer({ entityType, open, onClose, onCreated, initial = {} }) {
  const cfg = ENTITIES[entityType];
  const toast = useToast();
  const qc = useQueryClient();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [createKey, setCreateKey] = useState('');
  useEffect(() => { if (open) { setValues(initial); setErrors({}); setFormError(null); setCreateKey(Math.random().toString(36).slice(2)); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const create = useMutation({
    mutationFn: () => post(`/${cfg.route}`, buildPayload(values), { headers: { 'Idempotency-Key': `create-${entityType}-${createKey}` } }),
    onSuccess: (res) => {
      toast.success(`${cfg.label} created`);
      qc.invalidateQueries({ queryKey: [cfg.route] });
      onCreated?.(res.data);
      onClose();
    },
    onError: (err) => {
      setErrors(err.fieldErrors?.() || {});
      setFormError(err.details?.length ? 'Please fix the highlighted fields.' : err.message);
    },
  });
  return (
    <Drawer open={open} onClose={onClose} title={`New ${cfg.label.toLowerCase()}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={create.isPending} onClick={() => create.mutate()}>Create {cfg.label.toLowerCase()}</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <EntityForm entityType={entityType} values={values} onChange={setValues} errors={errors} formError={formError} />
      </form>
    </Drawer>
  );
}

function FilterControl({ f, value, onChange, me, members }) {
  if (f.type === 'select') return <Select aria-label={f.label} value={value ?? ''} placeholder={`${f.label}: any`} options={f.options} onChange={(e) => onChange(e.target.value)} />;
  if (f.type === 'pref') return <Select aria-label={f.label} value={value ?? ''} placeholder={`${f.label}: any`} options={(me?.tenant?.settings?.preferences?.[f.pref] || []).map((v) => ({ value: v, label: v.replace(/_/g, ' ') }))} onChange={(e) => onChange(e.target.value)} />;
  if (f.type === 'owner') return <Select aria-label={f.label} value={value ?? ''} placeholder={`${f.label}: anyone`} options={[{ value: 'me', label: 'Me' }, ...(members || []).map((m) => ({ value: m.user_id, label: fullName(m.user) }))]} onChange={(e) => onChange(e.target.value)} />;
  return <Input aria-label={f.label} type={f.type === 'number' ? 'number' : 'text'} placeholder={f.label} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
}

export function EntityListPage({ entityType, extraActions, rowLink }) {
  const cfg = ENTITIES[entityType];
  const { me, can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { state, update, apiParams } = useListParams({ sort: cfg.defaultSort });
  const [search, setSearch] = useState(state.q);
  const dq = useDebounce(search, 350);
  useEffect(() => { if (dq !== state.q) update({ q: dq }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps
  const [selected, setSelected] = useState([]);
  const [showFilters, setShowFilters] = useState(Object.keys(state.filter).length > 0);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTo, setAssignTo] = useState('');
  const [viewName, setViewName] = useState('');
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const cfDefs = useCustomFields(entityType);
  const members = useMembers();

  const list = useQuery({ queryKey: [cfg.route, apiParams], queryFn: ({ signal }) => get(`/${cfg.route}`, apiParams, { signal }), placeholderData: keepPreviousData });
  const views = useQuery({ queryKey: ['saved-views', entityType], queryFn: () => get('/me/saved-views', { entity_type: entityType }).then((r) => r.data) });

  const allColumns = useMemo(() => [
    ...cfg.columns,
    ...(cfDefs.data || []).map((d) => ({ key: `cf.${d.key}`, label: d.label, sortable: !['multiselect', 'textarea'].includes(d.field_type), render: (r) => formatCustomValue(d, r.custom_fields?.[d.key]), defaultVisible: d.show_in_list })),
  ], [cfg, cfDefs.data]);
  const [visibleKeys, setVisibleKeys] = useColumnPrefs(entityType, null);
  const defaultKeys = allColumns.filter((c) => !c.key.startsWith('cf.') || c.defaultVisible).map((c) => c.key);
  const shown = allColumns.filter((c) => (visibleKeys || defaultKeys).includes(c.key));

  const bulk = useMutation({
    mutationFn: (body) => post(`/${cfg.route}/bulk`, body),
    onSuccess: (res) => {
      const { succeeded, failed } = res.data;
      if (failed.length) toast.warning(`${succeeded.length} updated, ${failed.length} failed: ${failed[0].message}`);
      else toast.success(`${succeeded.length} record(s) updated`);
      setSelected([]);
      qc.invalidateQueries({ queryKey: [cfg.route] });
    },
    onError: (e) => toast.error(e),
  });
  const saveView = useMutation({
    mutationFn: () => post('/me/saved-views', { entity_type: entityType, name: viewName, filters: { filter: state.filter, cf: state.cf, q: state.q || undefined }, sort: state.sort || null, columns: visibleKeys || defaultKeys }),
    onSuccess: (res) => { toast.success('View saved'); setSaveViewOpen(false); views.refetch(); update({ view: res.data.id }); },
    onError: (e) => toast.error(e),
  });
  const deleteView = useMutation({ mutationFn: (id) => del(`/me/saved-views/${id}`), onSuccess: () => { views.refetch(); update({ view: '' }); } });

  const filterCount = Object.keys(state.filter).length + Object.keys(state.cf).length;
  const setFilter = (key, op, value) => {
    const next = { ...state.filter };
    if (value === '' || value === undefined) delete next[key];
    else next[key] = op ? { [op]: value } : value;
    update({ filter: next });
  };

  return (
    <>
      <PageHeader title={cfg.plural} subtitle={list.data?.meta ? `${list.data.meta.total.toLocaleString()} records` : ' '}
        actions={<>
          {extraActions}
          {can(`${cfg.module}:import`) && ['lead', 'contact', 'account', 'product'].includes(entityType) && <Button icon={Upload} onClick={() => navigate(`/imports/new?entity=${entityType}`)}>Import</Button>}
          {can(`${cfg.module}:export`) && <Button icon={Download} onClick={() => download(`/${cfg.route}/export`, apiParams, `${cfg.route}.csv`).catch((e) => toast.error(e))}>Export</Button>}
          {can(`${cfg.module}:create`) && <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>New {cfg.label.toLowerCase()}</Button>}
        </>} />
      <div className="card">
        <div className="toolbar">
          <div className="search grow" style={{ maxWidth: 360 }}><Search size={15} aria-hidden /><Input aria-label={`Search ${cfg.plural}`} placeholder={`Search ${cfg.plural.toLowerCase()}…`} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Select aria-label="Saved view" style={{ width: 200 }} value={state.view} placeholder="All records" options={(views.data || []).map((v) => ({ value: v.id, label: `${v.name}${v.is_shared ? ' (shared)' : ''}` }))} onChange={(e) => update({ view: e.target.value })} />
          {state.view && (views.data || []).find((v) => v.id === state.view && v.user_id === me.user.id) && <Button size="sm" variant="ghost" icon={Trash2} aria-label="Delete saved view" onClick={() => deleteView.mutate(state.view)} />}
          <Button icon={Filter} onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>Filters{filterCount ? ` (${filterCount})` : ''}</Button>
          <Button icon={Save} onClick={() => setSaveViewOpen(true)}>Save view</Button>
          <Dropdown align="right" label="Columns" trigger={(p) => <Button icon={Columns3} {...p}>Columns</Button>}>
            <div style={{ padding: 8, maxHeight: 320, overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
              {allColumns.map((c) => (
                <div key={c.key} style={{ padding: '4px 6px' }}>
                  <Checkbox label={c.label} checked={(visibleKeys || defaultKeys).includes(c.key)} onChange={(e) => { const cur = visibleKeys || defaultKeys; setVisibleKeys(e.target.checked ? [...cur, c.key] : cur.filter((k) => k !== c.key)); }} />
                </div>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setVisibleKeys(null)}>Reset columns</Button>
            </div>
          </Dropdown>
          {selected.length > 0 && (
            <div className="row tight" style={{ marginLeft: 'auto' }}>
              <span className="small muted">{selected.length} selected</span>
              {can(`${cfg.module}:assign`) && <Button size="sm" icon={UserPlus} onClick={() => setAssignOpen(true)}>Assign</Button>}
              {can(`${cfg.module}:delete`) && <Button size="sm" variant="danger" icon={Trash2} onClick={() => setConfirmDelete(true)}>Delete</Button>}
            </div>
          )}
        </div>
        {showFilters && (
          <div className="toolbar" style={{ background: 'var(--surface-2)' }}>
            {cfg.filters.map((f) => (
              <div key={f.key} style={{ width: 190 }}>
                <FilterControl f={f} me={me} members={members.data} value={f.op ? state.filter[f.key]?.[f.op] : state.filter[f.key]} onChange={(v) => setFilter(f.key, f.op, v)} />
              </div>
            ))}
            {(cfDefs.data || []).filter((d) => d.is_filterable && ['select', 'boolean', 'text'].includes(d.field_type)).map((d) => (
              <div key={d.id} style={{ width: 190 }}>
                {d.field_type === 'select' || d.field_type === 'boolean'
                  ? <Select aria-label={d.label} value={state.cf[d.key] ?? ''} placeholder={`${d.label}: any`} options={d.field_type === 'boolean' ? [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] : d.options.map((o) => ({ value: o.value, label: o.label }))} onChange={(e) => { const next = { ...state.cf }; if (e.target.value) next[d.key] = e.target.value; else delete next[d.key]; update({ cf: next }); }} />
                  : <Input aria-label={d.label} placeholder={d.label} value={state.cf[d.key]?.contains ?? ''} onChange={(e) => { const next = { ...state.cf }; if (e.target.value) next[d.key] = { contains: e.target.value }; else delete next[d.key]; update({ cf: next }); }} />}
              </div>
            ))}
            {filterCount > 0 && <Button variant="ghost" icon={X} onClick={() => update({ filter: {}, cf: {} })}>Clear filters</Button>}
          </div>
        )}
        <DataTable columns={shown} rows={list.data?.data} loading={list.isLoading} error={list.error} onRetry={list.refetch}
          sort={state.sort} onSort={(s) => update({ sort: s })} selectable={can(`${cfg.module}:update`) || can(`${cfg.module}:delete`)} selected={selected} onSelect={setSelected}
          onRowClick={rowLink === false ? undefined : (r) => navigate(rowLink ? rowLink(r) : `/${cfg.route}/${r.id}`)}
          empty={<EmptyState title={`No ${cfg.plural.toLowerCase()} yet`} message={filterCount || state.q ? 'No records match your filters.' : `Create your first ${cfg.label.toLowerCase()} to get started.`} action={can(`${cfg.module}:create`) && !filterCount ? <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>New {cfg.label.toLowerCase()}</Button> : null} />} />
        <Pagination meta={list.data?.meta} onPage={(page) => update({ page })} onPageSize={(page_size) => update({ page_size })} />
      </div>

      <CreateDrawer entityType={entityType} open={creating} onClose={() => setCreating(false)} onCreated={(r) => rowLink !== false && navigate(rowLink ? rowLink(r) : `/${cfg.route}/${r.id}`)} />
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} danger title={`Delete ${selected.length} record(s)?`} message="Deleted records are kept for the retention period and then purged. This action is audited." confirmLabel="Delete" loading={bulk.isPending}
        onConfirm={() => bulk.mutate({ ids: selected, action: 'delete' }, { onSettled: () => setConfirmDelete(false) })} />
      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign owner"
        footer={<><Button onClick={() => setAssignOpen(false)}>Cancel</Button><Button variant="primary" disabled={!assignTo} loading={bulk.isPending} onClick={() => bulk.mutate({ ids: selected, action: 'assign', data: { owner_id: assignTo } }, { onSettled: () => setAssignOpen(false) })}>Assign</Button></>}>
        <TextField as="select" label="New owner" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} placeholder="Choose a user" options={(members.data || []).map((m) => ({ value: m.user_id, label: fullName(m.user) }))} />
      </Modal>
      <Modal open={saveViewOpen} onClose={() => setSaveViewOpen(false)} title="Save current view"
        footer={<><Button onClick={() => setSaveViewOpen(false)}>Cancel</Button><Button variant="primary" disabled={!viewName} loading={saveView.isPending} onClick={() => saveView.mutate()}>Save view</Button></>}>
        <TextField label="View name" value={viewName} onChange={(e) => setViewName(e.target.value)} hint="Saves the current search, filters, sort and columns." />
      </Modal>
    </>
  );
}



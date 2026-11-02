import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { del } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Avatar, Button, ConfirmDialog, ErrorState, PageHeader, Skeleton, Tabs } from '../../components/ui';
import { ENTITIES } from './config';
import { useRecord, EditDrawer, Timeline, FilesPanel, CustomFieldsCard, ActivityComposer, OwnerHistory } from './RecordParts';

/**
 * Standard 360° record workspace: header + actions, main column (composer,
 * tabs: timeline / files / extra tabs), side column (details, custom fields,
 * ownership history). Feature pages customise via props.
 */
export function RecordPage({ entityType, id, actions, details, sideExtra, tabs = [], composerLinks, headerExtra }) {
  const cfg = ENTITIES[entityType];
  const rec = useRecord(entityType, id);
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState('timeline');
  const remove = useMutation({
    mutationFn: () => del(`/${cfg.route}/${id}`),
    onSuccess: () => { toast.success(`${cfg.label} deleted`); qc.invalidateQueries({ queryKey: [cfg.route] }); navigate(`/${cfg.route}`); },
    onError: (e) => { toast.error(e); setDeleting(false); },
  });
  if (rec.isLoading) return <Skeleton rows={8} height={22} />;
  if (rec.isError) return <ErrorState error={rec.error} onRetry={rec.refetch} />;
  const r = rec.data;
  const allTabs = [{ value: 'timeline', label: 'Activity' }, ...tabs.map((t) => ({ value: t.value, label: t.label, count: t.count })), { value: 'files', label: 'Files' }];
  return (
    <>
      <PageHeader breadcrumbs={[{ label: cfg.plural, to: `/${cfg.route}` }, { label: cfg.title(r) }]}
        title={<span className="row"><Avatar name={cfg.title(r)} size="lg" />{cfg.title(r)}{headerExtra?.(r)}</span>}
        subtitle={cfg.subtitle?.(r)}
        actions={<>
          {actions?.(r)}
          {can(`${cfg.module}:update`) && <Button icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>}
          {can(`${cfg.module}:delete`) && <Button variant="ghost" icon={Trash2} aria-label="Delete" onClick={() => setDeleting(true)} />}
        </>} />
      <div className="split">
        <div className="stack">
          {composerLinks && <ActivityComposer links={composerLinks(r)} />}
          <div className="card">
            <Tabs value={tab} onChange={setTab} tabs={allTabs} />
            <div className="card-body">
              {tab === 'timeline' && <Timeline entityType={entityType} id={id} />}
              {tab === 'files' && <FilesPanel entityType={entityType} id={id} />}
              {tabs.map((t) => tab === t.value && <div key={t.value}>{t.render(r)}</div>)}
            </div>
          </div>
        </div>
        <div className="stack">
          {details?.(r)}
          {sideExtra?.(r)}
          <CustomFieldsCard entityType={entityType} record={r} />
          <OwnerHistory entityType={entityType} id={id} />
        </div>
      </div>
      {editing && <EditDrawer entityType={entityType} record={r} open onClose={() => setEditing(false)} />}
      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} danger title={`Delete this ${cfg.label.toLowerCase()}?`} message="The record is soft-deleted and audited." confirmLabel="Delete" loading={remove.isPending} onConfirm={() => remove.mutate()} />
    </>
  );
}

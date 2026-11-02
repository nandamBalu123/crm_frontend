import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Skeleton, EmptyState, ErrorState } from '../ui';

/**
 * Server-driven data table. Sorting/pagination are delegated to the caller
 * (the API does the work); the table never loads more than one page.
 * columns: [{ key, label, render?(row), sortable?, align?, width? }]
 */
export function DataTable({ columns, rows, loading, error, onRetry, sort, onSort, onRowClick, selectable, selected = [], onSelect, empty, rowKey = (r) => r.id }) {
  const sortField = sort?.replace(/^-/, '');
  const desc = sort?.startsWith('-');
  const allSelected = rows?.length > 0 && rows.every((r) => selected.includes(rowKey(r)));
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {selectable && (
              <th className="check"><input type="checkbox" aria-label="Select all on this page" checked={allSelected} onChange={() => onSelect(allSelected ? selected.filter((id) => !rows.some((r) => rowKey(r) === id)) : [...new Set([...selected, ...rows.map(rowKey)])])} /></th>
            )}
            {columns.map((c) => (
              <th key={c.key} style={{ width: c.width, textAlign: c.align }} aria-sort={sortField === c.key ? (desc ? 'descending' : 'ascending') : undefined}>
                {c.sortable && onSort ? (
                  <button className="sort" type="button" onClick={() => onSort(sortField === c.key && !desc ? `-${c.key}` : c.key)}>
                    {c.label}
                    {sortField === c.key ? (desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : <ChevronsUpDown size={12} className="subtle" />}
                  </button>
                ) : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && !rows?.length ? (
            <tr><td colSpan={columns.length + (selectable ? 1 : 0)}><Skeleton rows={5} /></td></tr>
          ) : !rows?.length ? (
            <tr><td colSpan={columns.length + (selectable ? 1 : 0)} style={{ whiteSpace: 'normal' }}>{empty || <EmptyState title="No records found" message="Try adjusting your filters." />}</td></tr>
          ) : rows.map((r) => (
            <tr key={rowKey(r)} className={onRowClick ? 'clickable' : ''} onClick={onRowClick ? (e) => { if (!e.target.closest('input,button,a')) onRowClick(r); } : undefined}
              onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(r) : undefined} tabIndex={onRowClick ? 0 : undefined}>
              {selectable && <td className="check"><input type="checkbox" aria-label="Select row" checked={selected.includes(rowKey(r))} onChange={() => onSelect(selected.includes(rowKey(r)) ? selected.filter((x) => x !== rowKey(r)) : [...selected, rowKey(r)])} /></td>}
              {columns.map((c) => <td key={c.key} style={{ textAlign: c.align }}>{c.render ? c.render(r) : (r[c.key] ?? <span className="subtle">—</span>)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ meta, onPage, onPageSize }) {
  if (!meta) return null;
  const from = meta.total ? (meta.page - 1) * meta.page_size + 1 : 0;
  const to = Math.min(meta.total, meta.page * meta.page_size);
  return (
    <div className="pagination">
      <span>{from}–{to} of {meta.total.toLocaleString()}</span>
      <div className="row tight">
        {onPageSize && (
          <select className="select" style={{ width: 90, height: 28 }} value={meta.page_size} onChange={(e) => onPageSize(Number(e.target.value))} aria-label="Rows per page">
            {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
        )}
        <button className="btn sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</button>
        <span>Page {meta.page} of {Math.max(1, meta.total_pages)}</span>
        <button className="btn sm" disabled={meta.page >= meta.total_pages} onClick={() => onPage(meta.page + 1)}>Next</button>
      </div>
    </div>
  );
}

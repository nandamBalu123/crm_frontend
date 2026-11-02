import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, Pagination } from '../components/data/DataTable';
import { Modal, ConfirmDialog, TextField, Badge } from '../components/ui';
import { CustomFieldInput, formatCustomValue } from '../components/forms/CustomFieldInput';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rows = [{ id: '1', name: 'Ada' }, { id: '2', name: 'Bob' }];
const columns = [{ key: 'name', label: 'Name', sortable: true }];

test('DataTable sorts, selects and shows empty state', async () => {
  const onSort = vi.fn();
  const onSelect = vi.fn();
  const { rerender } = render(<DataTable columns={columns} rows={rows} sort="name" onSort={onSort} selectable selected={[]} onSelect={onSelect} />);
  await userEvent.click(screen.getByRole('button', { name: /Name/ }));
  expect(onSort).toHaveBeenCalledWith('-name');
  expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending');
  await userEvent.click(screen.getByLabelText('Select all on this page'));
  expect(onSelect).toHaveBeenCalledWith(['1', '2']);
  rerender(<DataTable columns={columns} rows={[]} />);
  expect(screen.getByText('No records found')).toBeInTheDocument();
});

test('DataTable renders API errors with request id', () => {
  render(<DataTable columns={columns} error={{ status: 500, message: 'Boom', requestId: 'req-123' }} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Request req-123');
});

test('Pagination reports ranges and disables bounds', async () => {
  const onPage = vi.fn();
  render(<Pagination meta={{ page: 1, page_size: 25, total: 60, total_pages: 3 }} onPage={onPage} />);
  expect(screen.getByText('1–25 of 60')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(onPage).toHaveBeenCalledWith(2);
});

test('Modal is an accessible dialog that closes on Escape', () => {
  const onClose = vi.fn();
  render(<Modal open onClose={onClose} title="Hello"><button>Inside</button></Modal>);
  expect(screen.getByRole('dialog', { name: 'Hello' })).toHaveAttribute('aria-modal', 'true');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalled();
});

test('ConfirmDialog confirms', async () => {
  const onConfirm = vi.fn();
  render(<ConfirmDialog open onClose={() => {}} onConfirm={onConfirm} message="Delete it?" confirmLabel="Delete" danger />);
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(onConfirm).toHaveBeenCalled();
});

test('TextField wires label, required and error for screen readers', () => {
  render(<TextField label="Email" required error="Invalid" value="" onChange={() => {}} />);
  const input = screen.getByLabelText(/Email/);
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription('Invalid');
});

test('Badge maps status tones', () => {
  render(<Badge value="won" />);
  expect(screen.getByText('Won')).toHaveClass('badge', 'success');
});

function wrap(ui) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
}

test('CustomFieldInput renders select options and multiselect checkboxes', async () => {
  const onChange = vi.fn();
  const def = { id: 'f', key: 'tier', label: 'Tier', field_type: 'select', is_required: true, options: [{ value: 'gold', label: 'Gold' }, { value: 'old', label: 'Old', is_active: false }] };
  wrap(<CustomFieldInput def={def} value="" onChange={onChange} />);
  const select = screen.getByLabelText(/Tier/);
  expect(screen.queryByRole('option', { name: 'Old' })).toBeNull();
  await userEvent.selectOptions(select, 'gold');
  expect(onChange).toHaveBeenCalledWith('gold');
  const multi = { ...def, field_type: 'multiselect', label: 'Tags', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] };
  const onMulti = vi.fn();
  wrap(<CustomFieldInput def={multi} value={['a']} onChange={onMulti} />);
  await userEvent.click(screen.getByLabelText('B'));
  expect(onMulti).toHaveBeenCalledWith(['a', 'b']);
});

test('formatCustomValue formats by type', () => {
  expect(formatCustomValue({ field_type: 'boolean' }, true)).toBe('Yes');
  expect(formatCustomValue({ field_type: 'multiselect', options: [{ value: 'a', label: 'A' }] }, ['a', 'z'])).toBe('A, z');
  expect(formatCustomValue({ field_type: 'percent' }, '12.5')).toBe('12.5%');
  expect(formatCustomValue({ field_type: 'text' }, '')).toBeNull();
});

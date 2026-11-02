import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button, Modal, TextField } from '../../components/ui';

export function LossReasonModal({ open, onClose, onConfirm }) {
  const { me } = useAuth();
  const [reason, setReason] = useState('');
  const options = me?.tenant?.settings?.preferences?.loss_reasons || [];
  return (
    <Modal open={open} onClose={onClose} title="Why was this deal lost?"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="danger" disabled={!reason} onClick={() => onConfirm(reason)}>Mark as lost</Button></>}>
      <TextField as="select" label="Loss reason" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Choose a reason" options={options} />
    </Modal>
  );
}

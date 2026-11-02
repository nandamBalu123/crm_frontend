import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { post } from '../../api/client';
import { useToast } from '../../context/ToastContext';

/** Moves a deal to a stage; asks for a loss reason when moving to a lost stage. */
export function useStageMove() {
  const qc = useQueryClient();
  const toast = useToast();
  const [pendingLoss, setPendingLoss] = useState(null);
  const move = useMutation({
    mutationFn: ({ id, stage_id, loss_reason }) => post(`/opportunities/${id}/move`, { stage_id, ...(loss_reason ? { loss_reason } : {}) }),
    onSuccess: (res) => {
      toast.success(`Moved to ${res.data.stage?.name}`);
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      qc.invalidateQueries({ queryKey: ['board'] });
      qc.invalidateQueries({ queryKey: ['timeline'] });
    },
    onError: (e) => toast.error(e),
  });
  const request = (opp, stage) => {
    if (stage.id === (opp.stage_id || opp.stage?.id)) return;
    if (stage.category === 'lost') setPendingLoss({ opp, stage });
    else move.mutate({ id: opp.id, stage_id: stage.id });
  };
  const confirmLoss = (reason) => {
    move.mutate({ id: pendingLoss.opp.id, stage_id: pendingLoss.stage.id, loss_reason: reason });
    setPendingLoss(null);
  };
  return { request, move, pendingLoss, cancelLoss: () => setPendingLoss(null), confirmLoss };
}

import * as Dialog from '@radix-ui/react-dialog';
import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../lib/api';

export const EmergencyOverride = () => {
  const [campaignId, setCampaignId] = useState('');
  const [duration, setDuration] = useState<'manual' | '15'>('manual');
  const campaignsQuery = useQuery({
    queryKey: ['campaigns'],
    queryFn: dashboardApi.getCampaigns,
  });

  const overrideMutation = useMutation({
    mutationFn: () =>
      dashboardApi.emergencyOverride(
        campaignId,
        [],
        duration === 'manual' ? undefined : Number(duration),
      ),
  });

  const canSubmit = useMemo(() => campaignId.length > 0 && !overrideMutation.isPending, [campaignId, overrideMutation.isPending]);

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="btn btn-danger emergency-btn">EMERGENCY OVERRIDE</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal">
          <Dialog.Title>Emergency Override</Dialog.Title>
          <p>This will immediately replace content on all devices.</p>
          <label>Campaign</label>
          <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">Select campaign</option>
            {(campaignsQuery.data ?? []).map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
          <label>Duration</label>
          <select value={duration} onChange={(e) => setDuration(e.target.value as 'manual' | '15')}>
            <option value="manual">Until manually cleared</option>
            <option value="15">15 minutes</option>
          </select>
          <div className="modal-actions">
            <Dialog.Close asChild>
              <button className="btn">Cancel</button>
            </Dialog.Close>
            <button className="btn btn-danger" disabled={!canSubmit} onClick={() => overrideMutation.mutate()}>
              Confirm Override
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};


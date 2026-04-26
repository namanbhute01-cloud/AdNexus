import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { Campaign } from '../../types';

type Props = {
  campaigns: Campaign[];
  onCreate: (campaignId: string, start: string, end: string) => void;
};

export const SlotEditor = ({ campaigns, onCreate }: Props) => {
  const [campaignId, setCampaignId] = useState('');
  const [start, setStart] = useState('06:00');
  const [end, setEnd] = useState('09:00');
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="btn">+ Add Slot</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal">
          <Dialog.Title>Create Slot</Dialog.Title>
          <label>Campaign</label>
          <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">Select campaign</option>
            {campaigns.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <label>Start</label>
          <input value={start} onChange={(e) => setStart(e.target.value)} />
          <label>End</label>
          <input value={end} onChange={(e) => setEnd(e.target.value)} />
          <button className="btn" onClick={() => onCreate(campaignId, start, end)} disabled={!campaignId}>
            Save
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};


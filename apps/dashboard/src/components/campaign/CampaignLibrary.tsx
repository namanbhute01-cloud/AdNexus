import * as Dialog from '@radix-ui/react-dialog';
import { useMemo, useState } from 'react';
import { Campaign } from '../../types';
import { CampaignCard } from './CampaignCard';

type Props = { campaigns: Campaign[] };

export const CampaignLibrary = ({ campaigns }: Props) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Campaign | null>(null);
  const filtered = useMemo(
    () => campaigns.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())),
    [campaigns, search],
  );

  return (
    <section className="stack">
      <input placeholder="Search campaigns" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="grid grid-3">
        {filtered.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} onSelect={setSelected} />
        ))}
      </div>

      <Dialog.Root open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="modal-overlay" />
          <Dialog.Content className="modal">
            <Dialog.Title>{selected?.name}</Dialog.Title>
            <div className="preview-frame">Campaign preview</div>
            <p>Duration: {selected?.duration_seconds ?? 0}s</p>
            <p>Resolution: {selected?.resolution ?? '-'}</p>
            <button className="btn">Assign to Device</button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
};


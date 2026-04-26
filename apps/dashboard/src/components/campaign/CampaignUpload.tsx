import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from '../../lib/api';

export const CampaignUpload = () => {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(30);
  const [file, setFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('File required');
      const form = new FormData();
      form.append('file', file);
      form.append('name', name);
      form.append('durationSeconds', String(duration));
      form.append('organizationId', '11111111-1111-1111-1111-111111111111');
      return dashboardApi.uploadCampaign(form);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <form className="card stack" onSubmit={onSubmit}>
      <h3>Upload Campaign</h3>
      <input placeholder="Campaign name" value={name} onChange={(e) => setName(e.target.value)} required />
      <input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} required />
      <input type="file" accept="video/*,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
      <button className="btn" type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Uploading...' : 'Upload'}
      </button>
    </form>
  );
};


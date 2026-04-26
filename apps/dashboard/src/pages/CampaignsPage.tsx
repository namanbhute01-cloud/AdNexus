import { useQuery } from '@tanstack/react-query';
import { CampaignLibrary } from '../components/campaign/CampaignLibrary';
import { CampaignUpload } from '../components/campaign/CampaignUpload';
import { dashboardApi } from '../lib/api';
import { mockCampaigns } from '../data/mock';

export const CampaignsPage = () => {
  const campaignsQuery = useQuery({ queryKey: ['campaigns'], queryFn: dashboardApi.getCampaigns });
  const campaigns = campaignsQuery.data ?? mockCampaigns;

  return (
    <section className="stack">
      <CampaignUpload />
      <CampaignLibrary campaigns={campaigns} />
    </section>
  );
};


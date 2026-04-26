import { Campaign } from '../../types';
import { Badge } from '../common/Badge';

type Props = { campaign: Campaign; onSelect?: (campaign: Campaign) => void };

export const CampaignCard = ({ campaign, onSelect }: Props) => (
  <button className="card campaign-card" onClick={() => onSelect?.(campaign)}>
    <div className="preview-frame">{campaign.name}</div>
    <div className="row-between">
      <span>{campaign.name}</span>
      <Badge>{campaign.duration_seconds}s</Badge>
    </div>
    <div className="muted">{campaign.resolution ?? '-'}</div>
  </button>
);


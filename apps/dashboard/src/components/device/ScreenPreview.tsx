import { ScreenPreviewData } from '../../types';
import { Badge } from '../common/Badge';

type Props = { screen: ScreenPreviewData };

export const ScreenPreview = ({ screen }: Props) => (
  <div className="card screen-preview">
    <div className="muted">
      Screen {screen.position} · {screen.type} · {screen.resolution}
    </div>
    <div className="preview-frame">{screen.campaign_name}</div>
    <div className="row-between">
      <Badge>{screen.mode}</Badge>
      <Badge tone={screen.synced ? 'success' : 'warning'}>{screen.synced ? 'Synced' : 'Unsynced'}</Badge>
    </div>
  </div>
);


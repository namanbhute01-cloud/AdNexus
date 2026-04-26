import { PlayMode } from '../../types';

type Props = { mode: PlayMode; onChange: (mode: PlayMode) => void };

export const ModeSelector = ({ mode, onChange }: Props) => (
  <div className="mode-buttons">
    {(['MIRROR', 'INDEPENDENT', 'COMBINED'] as PlayMode[]).map((item) => (
      <button key={item} className={`btn ${item === mode ? 'btn-active' : ''}`} onClick={() => onChange(item)}>
        {item}
      </button>
    ))}
  </div>
);


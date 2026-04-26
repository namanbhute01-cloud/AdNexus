import { ScheduleSlot } from '../../types';

type Props = { slots: ScheduleSlot[] };

export const ScheduleTimeline = ({ slots }: Props) => {
  return (
    <div className="card stack">
      <h3>Schedule Timeline</h3>
      {slots.map((slot) => (
        <div key={slot.id} className="timeline-slot" draggable>
          <span>{slot.start}</span>
          <strong>{slot.campaignName}</strong>
          <span>{slot.end}</span>
        </div>
      ))}
    </div>
  );
};


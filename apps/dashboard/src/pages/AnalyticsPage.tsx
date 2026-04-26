import { FleetSummary } from '../components/analytics/FleetSummary';
import { ImpressionsChart } from '../components/analytics/ImpressionsChart';
import { UptimeChart } from '../components/analytics/UptimeChart';
import { mockFleetStats } from '../data/mock';

export const AnalyticsPage = () => {
  return (
    <section className="stack">
      <div className="card row-gap">
        <input type="date" />
        <input type="date" />
        <button className="btn">Export CSV</button>
      </div>
      <FleetSummary
        online={mockFleetStats.online}
        offline={mockFleetStats.offline}
        alerts={mockFleetStats.alerts}
        uptime={mockFleetStats.uptimePercent}
      />
      <div className="grid grid-2">
        <ImpressionsChart />
        <UptimeChart />
      </div>
    </section>
  );
};


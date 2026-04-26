import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';

const data = [
  { day: 'Mon', uptime: 98.9 },
  { day: 'Tue', uptime: 99.1 },
  { day: 'Wed', uptime: 99.3 },
  { day: 'Thu', uptime: 98.8 },
  { day: 'Fri', uptime: 99.2 },
];

export const UptimeChart = () => (
  <div className="card chart-card">
    <h3>Uptime</h3>
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <XAxis dataKey="day" stroke="#7B8194" />
        <YAxis stroke="#7B8194" domain={[97, 100]} />
        <Tooltip />
        <Line type="monotone" dataKey="uptime" stroke="#00E5FF" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);


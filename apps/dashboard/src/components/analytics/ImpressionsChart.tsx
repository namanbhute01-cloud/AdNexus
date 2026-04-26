import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const data = [
  { campaign: 'Swiggy', plays: 5200 },
  { campaign: 'Nykaa', plays: 4700 },
  { campaign: 'Coke', plays: 6100 },
];

export const ImpressionsChart = () => (
  <div className="card chart-card">
    <h3>Impressions</h3>
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <XAxis dataKey="campaign" stroke="#7B8194" />
        <YAxis stroke="#7B8194" />
        <Tooltip />
        <Bar dataKey="plays" fill="#00E676" />
      </BarChart>
    </ResponsiveContainer>
  </div>
);


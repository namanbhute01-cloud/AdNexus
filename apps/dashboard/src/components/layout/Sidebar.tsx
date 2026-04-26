import { NavLink } from 'react-router-dom';
import { EmergencyOverride } from '../common/EmergencyOverride';

const items = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/devices', label: 'Devices' },
  { to: '/campaigns', label: 'Campaigns' },
  { to: '/schedules', label: 'Schedule' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/settings', label: 'Settings' },
];

export const Sidebar = () => {
  return (
    <aside className="sidebar">
      <div className="brand">ADNEXUS</div>
      <nav>
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <EmergencyOverride />
    </aside>
  );
};


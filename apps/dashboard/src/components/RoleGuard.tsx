import { Navigate } from 'react-router-dom';

interface RoleGuardProps {
  role: string | string[];
  children: React.ReactNode;
}

export function RoleGuard({ role, children }: RoleGuardProps) {
  const token = window.localStorage.getItem('adnexus.token');
  const userRole = window.localStorage.getItem('adnexus.role');

  const allowed = Array.isArray(role) ? role.includes(userRole ?? '') : userRole === role;

  if (!token || !allowed) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

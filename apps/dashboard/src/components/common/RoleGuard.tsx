import { Navigate } from 'react-router-dom';
import React from 'react';

interface RoleGuardProps {
  role: string | string[];
  children: React.ReactNode;
}

export function RoleGuard({ role, children }: RoleGuardProps) {
  const userRole = window.localStorage.getItem('adnexus.role');

  const allowed = Array.isArray(role) 
    ? role.includes(userRole ?? '') 
    : userRole === role;

  if (!allowed) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

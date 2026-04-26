import { ReactNode } from 'react';

type Props = { children: ReactNode; tone?: 'default' | 'success' | 'warning' | 'danger' };

export const Badge = ({ children, tone = 'default' }: Props) => {
  return <span className={`badge badge-${tone}`}>{children}</span>;
};


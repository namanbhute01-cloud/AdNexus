import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

type Props = { children: ReactNode };

export const AppShell = ({ children }: Props) => {
  return (
    <div className="shell">
      <Sidebar />
      <div className="content-wrap">
        <TopBar />
        <main className="content">{children}</main>
      </div>
    </div>
  );
};


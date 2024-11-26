import { ReactNode } from 'react';

export function SidebarContainer({ children }: { children: ReactNode[] }) {
  return (
    <div id="sidebar" data-testid="sidebar">
      <div className="hidden h-full w-72 flex-col border-r border-slate-200 md:flex dark:border-slate-700 dark:bg-slate-900">
        <div className="relative flex flex-col gap-4 overflow-y-scroll p-4">
          {...children}
        </div>
      </div>
    </div>
  );
}

// TODO@ben: refactor to use HeadlessUI tabs
import cx from 'classnames';
import { createContext, ReactNode, useContext, useState } from 'react';

export const TabContext = createContext('');

export function Tabs({
  labels,
  children,
}: {
  labels: string[];
  children: ReactNode;
}) {
  const [currentTab, setCurrentTab] = useState(labels[0]);

  return (
    <TabContext.Provider value={currentTab}>
      <section className="mb-8 py-4">
        <div className="not-prose ">
          <div className="border-b border-gray-100">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {labels.map((label: string) => (
                <button
                  key={label}
                  role="tab"
                  aria-selected={label === currentTab}
                  onClick={() => setCurrentTab(label)}
                  className={cx(
                    'whitespace-nowrap border-b-2 border-transparent py-4 px-2 text-sm font-medium',
                    label === currentTab
                      ? 'border-slate-500 text-slate-800'
                      : 'text-slate-500 hover:border-slate-500 hover:text-slate-800'
                  )}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>
        {children}
      </section>
    </TabContext.Provider>
  );
}

export function Tab({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const currentTab = useContext(TabContext);

  if (label !== currentTab) {
    return null;
  }

  return <div className="prose">{children}</div>;
}

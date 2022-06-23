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
      <div className="hidden sm:block">
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
                    ? 'border-blue-100 text-blue-700'
                    : 'text-gray-500 hover:border-gray-300 hover:text-gray-700'
                )}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>
      {children}
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

  return children;
}

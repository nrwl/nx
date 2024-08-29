'use client';
import cx from 'classnames';
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
  cloneElement,
} from 'react';

export const TabContext = createContext('');
export const SELECTED_TAB_KEY = 'selectedTab';
export const TAB_SELECTED_EVENT = 'tabSelectedEvent';

export function Tabs({
  labels,
  children,
}: {
  labels: string[];
  children: ReactNode;
}) {
  const [currentTab, setCurrentTab] = useState<string>(labels[0]);

  useEffect(() => {
    const handleTabSelectedEvent = (defaultTab?: string) => {
      const selectedTab = localStorage.getItem(SELECTED_TAB_KEY);
      if (selectedTab && labels.includes(selectedTab)) {
        setCurrentTab(selectedTab);
      } else if (defaultTab) {
        setCurrentTab(defaultTab);
      }
    };

    handleTabSelectedEvent(labels[0]);
    window.addEventListener(TAB_SELECTED_EVENT, handleTabSelectedEvent);
    return () =>
      window.removeEventListener(TAB_SELECTED_EVENT, handleTabSelectedEvent);
  }, [labels]);

  const handleTabClick = (label: string) => {
    localStorage.setItem(SELECTED_TAB_KEY, label);
    window.dispatchEvent(new Event(TAB_SELECTED_EVENT));
    setCurrentTab(label);
  };

  return (
    <TabContext.Provider value={currentTab}>
      <nav className="not-prose -mb-px flex space-x-8" aria-label="Tabs">
        {labels.map((label, index) => (
          <button
            key={label}
            role="tab"
            aria-selected={label === currentTab}
            onClick={() => handleTabClick(label)}
            className={cx(
              'whitespace-nowrap border-b-2 p-2 text-sm font-medium',
              label === currentTab
                ? 'border-blue-500 text-slate-800 dark:border-sky-500 dark:text-slate-300'
                : 'border-transparent text-slate-500 hover:border-blue-500 hover:text-slate-800 dark:text-slate-400 dark:hover:border-sky-500 dark:hover:text-slate-300'
            )}
          >
            {label}
          </button>
        ))}
      </nav>
      <div
        className={cx(
          'border border-slate-200 pb-2 pl-4 pr-4 pt-2 dark:border-slate-700',
          currentTab === labels[0]
            ? 'rounded-b-md rounded-tr-md'
            : 'rounded-b-md rounded-t-md'
        )}
      >
        {children}
      </div>
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
  const isActive = label === currentTab;

  const passPropsToChildren = (children: ReactNode) => {
    return React.Children.map(children, (child) => {
      if (React.isValidElement(child) && typeof child.type !== 'string') {
        return cloneElement(child, { isWithinTab: true });
      }
      return child;
    });
  };

  return (
    <div
      className="prose prose-slate dark:prose-invert mt-2 max-w-none"
      hidden={!isActive}
    >
      {isActive && passPropsToChildren(children)}
    </div>
  );
}

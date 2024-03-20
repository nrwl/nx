import { ArrowDownIcon, ArrowUpIcon } from '@heroicons/react/24/outline';
import { ReactNode, useEffect, useRef, useState } from 'react';

export function FadingCollapsible({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  const [isCollapsible, setIsCollapsible] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      setIsCollapsible(contentRef.current.offsetHeight > 300);
    }
  }, [contentRef, children]);

  function toggleCollapsed() {
    setCollapsed(!collapsed);
  }

  const fadeStyles =
    collapsed && isCollapsible
      ? {
          maxHeight: '150px',
          maskImage: 'linear-gradient(to bottom, black 40%, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent)',
        }
      : {};
  return (
    <div
      className={`relative overflow-hidden ${
        collapsed && isCollapsible ? 'cursor-pointer' : 'max-h-full'
      }`}
      onClick={() => collapsed && isCollapsible && toggleCollapsed()}
    >
      <div
        className={`${
          collapsed && isCollapsible
            ? 'hover:bg-slate-200 dark:hover:bg-slate-700'
            : ''
        } rounded-md`}
        style={fadeStyles}
      >
        <div ref={contentRef}>{children}</div>
      </div>
      {isCollapsible && (
        <div
          className="absolute bottom-2 right-1/2 h-4 w-4 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapsed();
          }}
        >
          {collapsed ? <ArrowDownIcon /> : <ArrowUpIcon />}
        </div>
      )}
    </div>
  );
}

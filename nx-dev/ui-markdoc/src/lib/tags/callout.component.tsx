'use client';

import React, { useState, useEffect } from 'react';
import cx from 'classnames';
import {
  ChevronRightIcon,
  ChevronDownIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  HandRaisedIcon,
  InformationCircleIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';

type CalloutType = 'note' | 'warning' | 'check' | 'caution' | 'deepdive';

const typeMap: Record<
  CalloutType,
  {
    icon: JSX.Element;
    backgroundColor: string;
    borderColor: string;
    titleColor: string;
    textColor: string;
  }
> = {
  note: {
    icon: (
      <InformationCircleIcon
        className="h-5 w-5 text-slate-500 dark:text-slate-300"
        aria-hidden="true"
      />
    ),
    backgroundColor: 'bg-slate-50 dark:bg-slate-800/40',
    borderColor: 'border-slate-200 dark:border-slate-700',
    titleColor: 'text-slate-600 dark:text-slate-300',
    textColor: 'text-slate-700 dark:text-slate-400',
  },
  warning: {
    icon: (
      <ExclamationCircleIcon
        className="h-5 w-5 text-yellow-500 dark:text-yellow-400"
        aria-hidden="true"
      />
    ),
    backgroundColor: 'bg-yellow-50 dark:bg-yellow-900/30',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    titleColor: 'text-yellow-600 dark:text-yellow-400',
    textColor: 'text-yellow-700 dark:text-yellow-600',
  },
  check: {
    icon: (
      <CheckCircleIcon
        className="h-5 w-5 text-green-500 dark:text-green-400"
        aria-hidden="true"
      />
    ),
    backgroundColor: 'bg-green-50 dark:bg-green-900/30',
    borderColor: 'border-green-200 dark:border-green-800',
    titleColor: 'text-green-600 dark:text-green-400',
    textColor: 'text-green-700 dark:text-green-600',
  },
  caution: {
    icon: (
      <HandRaisedIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
    ),
    backgroundColor: 'bg-red-50 dark:bg-red-900/30',
    borderColor: 'border-red-200 dark:border-red-800',
    titleColor: 'text-red-600 dark:text-red-400',
    textColor: 'text-red-700 dark:text-red-600',
  },
  deepdive: {
    icon: (
      <AcademicCapIcon className="h-5 w-5 text-blue-500" aria-hidden="true" />
    ),
    backgroundColor: 'bg-blue-50 dark:bg-blue-900/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    titleColor: 'text-white-600 dark:text-white-400',
    textColor: 'text-white-700 dark:text-white-600',
  },
};

export function Callout({
  title,
  type,
  children,
  defaultExpanded = false,
}: {
  title: string;
  type: CalloutType;
  children: ReactNode;
  defaultExpanded?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(type !== 'deepdive');
  const ui = typeMap[type] || typeMap.note;
  const isCollapsible = type === 'deepdive';

  useEffect(() => {
    if (isCollapsible) {
      setIsOpen(defaultExpanded);
    }
  }, [defaultExpanded, isCollapsible]);

  const toggleOpen = () => {
    if (isCollapsible) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div
      className={cx(
        'my-6 overflow-hidden rounded-md border',
        ui.borderColor,
        ui.backgroundColor
      )}
    >
      <div
        onClick={toggleOpen}
        className={cx(
          'flex w-full items-center justify-between p-4',
          'transition-colors duration-200 hover:bg-opacity-80',
          { 'cursor-pointer': isCollapsible }
        )}
      >
        <span className="flex items-center">
          <span className="flex-shrink-0">{ui.icon}</span>
          <span className={cx('ml-3 text-sm font-medium', ui.titleColor)}>
            {title}
          </span>
        </span>
        {isCollapsible &&
          (isOpen ? (
            <ChevronDownIcon className="h-5 w-5" />
          ) : (
            <ChevronRightIcon className="h-5 w-5" />
          ))}
      </div>
      {isOpen && (
        <div className="px-4 pb-4 pt-0">
          <span className={cx('prose-sm block', ui.textColor)}>{children}</span>
        </div>
      )}
    </div>
  );
}

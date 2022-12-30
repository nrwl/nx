import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  HandRaisedIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import cx from 'classnames';
import { ReactNode } from 'react';

type CalloutType = 'note' | 'warning' | 'check' | 'caution';
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
    borderColor: 'ring-slate-100 dark:ring-slate-700',
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
    borderColor: 'ring-yellow-100 dark:ring-yellow-900',
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
    borderColor: 'ring-green-100 dark:ring-green-900',
    titleColor: 'text-green-600 dark:text-green-400',
    textColor: 'text-green-700 dark:text-green-600',
  },
  caution: {
    icon: (
      <HandRaisedIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
    ),
    backgroundColor: 'bg-red-50 dark:bg-red-900/30',
    borderColor: 'ring-red-100 dark:ring-red-900',
    titleColor: 'text-red-600 dark:text-red-400',
    textColor: 'text-red-700 dark:text-red-600',
  },
};

export function Callout({
  title,
  type,
  children,
}: {
  title: string;
  type: CalloutType;
  children: ReactNode;
}) {
  const ui = typeMap[type] || typeMap.note;

  // We use `<span>`s because we are inside `<p>`s
  return (
    <span
      className={cx(
        'my-6 block rounded-md p-4 ring-1',
        ui.backgroundColor,
        ui.borderColor
      )}
    >
      <span className="flex">
        <span className="flex-shrink-0">{ui.icon}</span>
        <span className="ml-3">
          <span className={cx('mt-0 block text-sm font-medium', ui.titleColor)}>
            {title}
          </span>
          <span className={cx('prose-sm mt-2 block', ui.textColor)}>
            {children}
          </span>
        </span>
      </span>
    </span>
  );
}

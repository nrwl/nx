import {
  CheckCircleIcon,
  ExclamationIcon,
  InformationCircleIcon,
  XCircleIcon,
} from '@heroicons/react/outline';
import cx from 'classnames';
import { ReactNode } from 'react';

type CalloutType = 'note' | 'warning' | 'check' | 'error';
const typeMap: Record<
  CalloutType,
  {
    icon: JSX.Element;
    backgroundColor: string;
    titleColor: string;
    textColor: string;
  }
> = {
  note: {
    icon: (
      <InformationCircleIcon
        className="h-5 w-5 text-blue-400"
        aria-hidden="true"
      />
    ),
    backgroundColor: 'bg-blue-50',
    titleColor: 'text-blue-800',
    textColor: 'text-blue-700',
  },
  warning: {
    icon: (
      <ExclamationIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
    ),
    backgroundColor: 'bg-yellow-50',
    titleColor: 'text-yellow-800',
    textColor: 'text-yellow-700',
  },
  check: {
    icon: (
      <CheckCircleIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
    ),
    backgroundColor: 'bg-slate-50',
    titleColor: 'text-slate-800',
    textColor: 'text-slate-700',
  },
  error: {
    icon: <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />,
    backgroundColor: 'bg-red-50',
    titleColor: 'text-red-800',
    textColor: 'text-red-700',
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

  return (
    <div className={cx('mb-6 rounded-md p-4', ui.backgroundColor)}>
      <div className="flex">
        <div className="flex-shrink-0">{ui.icon}</div>
        <div className="ml-3">
          <h3 className={cx('mt-0 text-sm font-medium', ui.titleColor)}>
            {title}
          </h3>
          <div className={cx('mt-2 text-sm', ui.textColor)}>{children}</div>
        </div>
      </div>
    </div>
  );
}

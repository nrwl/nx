import {
  CheckCircleIcon,
  ExclamationIcon,
  InformationCircleIcon,
  HandIcon,
} from '@heroicons/react/outline';
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
        className="h-5 w-5 text-slate-500"
        aria-hidden="true"
      />
    ),
    backgroundColor: 'bg-slate-50',
    borderColor: 'ring-slate-100',
    titleColor: 'text-slate-600',
    textColor: 'text-slate-700',
  },
  warning: {
    icon: (
      <ExclamationIcon className="h-5 w-5 text-yellow-500" aria-hidden="true" />
    ),
    backgroundColor: 'bg-yellow-50',
    borderColor: 'ring-yellow-100',
    titleColor: 'text-yellow-600',
    textColor: 'text-yellow-700',
  },
  check: {
    icon: (
      <CheckCircleIcon className="h-5 w-5 text-green-500" aria-hidden="true" />
    ),
    backgroundColor: 'bg-green-50',
    borderColor: 'ring-green-100',
    titleColor: 'text-green-600',
    textColor: 'text-green-700',
  },
  caution: {
    icon: <HandIcon className="h-5 w-5 text-red-500" aria-hidden="true" />,
    backgroundColor: 'bg-red-50',
    borderColor: 'ring-red-100',
    titleColor: 'text-red-600',
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
    <aside
      className={cx(
        'my-6 rounded-md p-4 ring-1',
        ui.backgroundColor,
        ui.borderColor
      )}
    >
      <div className="flex">
        <div className="flex-shrink-0">{ui.icon}</div>
        <div className="ml-3">
          <h5 className={cx('mt-0 text-sm font-medium', ui.titleColor)}>
            {title}
          </h5>
          <div className={cx('prose-sm mt-2', ui.textColor)}>{children}</div>
        </div>
      </div>
    </aside>
  );
}

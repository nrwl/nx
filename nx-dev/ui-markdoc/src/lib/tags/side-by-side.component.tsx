import { cx } from '@nx/nx-dev-ui-primitives';
import { Children, ReactNode } from 'react';

export function SideBySide({
  align,
  children,
}: {
  align: string;
  children: ReactNode;
}) {
  const [first, ...rest] = Children.toArray(children);
  return (
    <div
      className={cx(
        'not-prose grid divide-x divide-solid divide-slate-50 md:grid-cols-2 dark:divide-slate-800',
        align === 'top' ? 'items-start' : 'items-center'
      )}
    >
      <div className="md:pr-6">{first}</div>
      <div className="md:pl-6">{rest}</div>
    </div>
  );
}

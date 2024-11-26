import { twMerge } from 'tailwind-merge';

export function Pill({
  text,
  color = 'grey',
  tooltip,
}: {
  text: string;
  color?: 'grey' | 'green' | 'yellow';
  tooltip?: string;
}) {
  return (
    <span
      data-tooltip={tooltip}
      className={twMerge(
        'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset',
        color === 'grey' &&
          'bg-slate-400/10 text-slate-600 ring-slate-400/40 dark:text-slate-400 dark:ring-slate-400/30',
        color === 'green' &&
          'bg-green-400/10 text-green-500 ring-green-500/40 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20',
        color === 'yellow' &&
          'bg-yellow-50 text-yellow-600 ring-yellow-500/40 dark:bg-yellow-900/30 dark:text-yellow-400 dark:ring-yellow-500/20'
      )}
    >
      {text}
    </span>
  );
}

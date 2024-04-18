import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { twMerge } from 'tailwind-merge';
import { TargetTechnologies } from '../target-technologies/target-technologies';

export interface TargetGroupProps {
  name: string;
  selected: boolean;
  isCompact: boolean;
  onClick: (name: string) => void;
  technologies?: string[];
}

export function TargetGroup({
  selected,
  name,
  onClick,
  isCompact,
  technologies,
}: TargetGroupProps) {
  return (
    <li
      role="menuitem"
      className={twMerge(
        `group relative cursor-pointer overflow-hidden hover:bg-slate-50 dark:hover:bg-slate-800/60`,
        isCompact ? 'px-2 py-1' : 'p-2',
        selected
          ? 'bg-slate-50 dark:border-slate-700/60 dark:border-slate-300/10 dark:bg-slate-800'
          : ''
      )}
      onClick={() => onClick(name)}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center justify-between gap-2 font-medium dark:text-slate-300">
          <TargetTechnologies technologies={technologies} showTooltip={false} />
          {name}
        </h3>
        <ChevronRightIcon className="h-3 w-3" />
      </div>
    </li>
  );
}

import {
  CodeBracketIcon,
  CommandLineIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import { ReactElement } from 'react';

export function FeatureContainer({
  icon,
  children,
}: {
  icon?: 'code' | 'command-line' | 'user-plus';
  children: ReactElement | ReactElement[];
}): ReactElement {
  return (
    <div className="flex items-stretch">
      <div className="flex flex-col items-center">
        <div className="sticky top-20 hidden h-[3rem] w-[3rem] items-center justify-center rounded-full bg-slate-200 shadow-xl md:flex dark:bg-slate-800">
          {icon === 'code' && (
            <CodeBracketIcon className="h-6 w-6 text-slate-400" />
          )}
          {icon === 'command-line' && (
            <CommandLineIcon className="h-6 w-6 text-slate-400" />
          )}
          {icon === 'user-plus' && (
            <UserPlusIcon className="h-6 w-6 text-slate-400" />
          )}
        </div>
        <div className="hidden h-full w-[3px] bg-gradient-to-b from-slate-200 via-purple-500 to-slate-50 md:block dark:from-slate-800 dark:via-purple-500 dark:to-slate-900"></div>
      </div>
      <div className="mb-32 md:ml-16">{children}</div>
    </div>
  );
}

import { ReactNode } from 'react';

export function TooltipTriggerText({
  children,
}: {
  children: string | ReactNode;
}) {
  return (
    <span className="cursor-help underline decoration-slate-700/50 decoration-dotted decoration-2 underline-offset-8 dark:decoration-slate-400/50">
      {children}
    </span>
  );
}

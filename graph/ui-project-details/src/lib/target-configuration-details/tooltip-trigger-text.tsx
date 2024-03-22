import { ReactNode } from 'react';

export function TooltipTriggerText({
  children,
}: {
  children: string | ReactNode;
}) {
  return (
    <span className="underline cursor-help underline-offset-8 decoration-2 decoration-dotted decoration-slate-700/50 dark:decoration-slate-400/50">
      {children}
    </span>
  );
}

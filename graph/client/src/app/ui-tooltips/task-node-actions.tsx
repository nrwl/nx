import { TaskNodeTooltipProps } from '@nx/graph/ui-tooltips';
import { useState } from 'react';

export function TaskNodeActions(props: TaskNodeTooltipProps) {
  const files = [
    'apps/nx-docs/src/app/app.module.ts',
    'apps/nx-docs/src/app/app.component.ts',
    'apps/nx-docs/src/app/app.component.html',
    'apps/nx-docs/src/app/app.component.spec.ts',
    'apps/nx-docs/src/app/app.component.css',
    'apps/nx-docs/src/app/app-routing.module.ts',
    'apps/nx-docs/src/app/home/home.module.ts',
    'apps/nx-docs/src/app/home/home.component.ts',
    'apps/nx-docs/src/app/home/home.component.html',
    'apps/nx-docs/src/app/home/home.component.spec.ts',
    'apps/nx-docs/src/app/home/home.component.css',
    'apps/nx-docs/src/app/home/home-routing.module.ts',
    'apps/nx-docs/src/app/shared/shared.module.ts',
    'apps/nx-docs/src/app/shared/header/header.component.ts',
    'apps/nx-docs/src/app/shared/header/header.component.html',
    'apps/nx-docs/src/app/shared/header/header.component.spec.ts',
    'apps/nx-docs/src/app/shared/header/header.component.css',
    'apps/nx-docs/src/app/shared/footer/footer.component.ts',
    'apps/nx-docs/src/app/shared/footer/footer.component.html',
    'apps/nx-docs/src/app/shared/footer/footer.component.spec.ts',
    'apps/nx-docs/src/app/shared/footer/footer.component.css',
    'apps/nx-docs/src/app/shared/footer/footer-routing.module.ts',
    'apps/nx-docs/src/app/shared/footer/footer.module.ts',
    'apps/nx-docs/src/app/shared/footer/footer-routing.module.ts',
    'apps/nx-docs/src/app/shared/footer/footer.module.ts',
    'apps/nx-docs/src/app/shared/footer/footer-routing.module.ts',
    'apps/nx-docs/src/app/shared/footer/footer.module.ts',
    'apps/nx-docs/src/app/shared/footer/footer-routing.module.ts',
    'apps/nx-docs/src/app/shared/footer/footer.module.ts',
    'apps/nx-docs/src/app/shared/footer/footer-routing.module.ts',
    'apps/nx-docs/src/app/shared/footer/footer.module.ts',
    'apps/nx-docs/src/app/shared/footer/footer-routing.module.ts',
    'apps/nx-docs/src/app/shared/footer/footer.module.ts',
    'apps/nx-docs/src/app/shared/footer/footer-routing.module.ts',
    'apps/nx-docs/src/app/shared/footer/footer.module.ts',
    'apps/nx-docs/src/app/shared/footer/footer-routing.module.ts',
  ];
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-800 w-full"
      onClick={() => setIsOpen(!isOpen)}
    >
      <div className="flex justify-between items-center w-full bg-slate-50 px-4 py-2 text-xs font-medium uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <span>Inputs</span>
        <span
          className={`transform transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          ▲
        </span>
      </div>
      <ul
        className={`max-h-[300px] divide-y divide-slate-200 overflow-auto dark:divide-slate-800 ${
          !isOpen && 'invisible relative h-0 overflow-hidden p-0 m-0'
        }`}
      >
        {files.map((fileDep) => (
          <li
            key={fileDep}
            className="whitespace-nowrap px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-300"
          >
            <span className="block truncate font-normal">{fileDep}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

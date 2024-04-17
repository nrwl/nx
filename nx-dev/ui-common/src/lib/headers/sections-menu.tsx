import type { MenuItem } from './menu-items';
import { DefaultMenuItem } from './default-menu-item';

export function SectionsMenu({
  sections,
}: {
  sections: Record<string, MenuItem[]>;
}): JSX.Element {
  return (
    <div className="overflow-hidden flex flex-col gap-2 rounded-lg bg-white shadow-lg ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {Object.keys(sections).map((section) => (
          <div>
            <h5 className="text-sm pt-6 px-4 text-slate-500 dark:text-slate-400">
              {section}
            </h5>
            <div className="grid gap-2 grid-cols-2 p-2">
              {sections[section].map((item) => (
                <DefaultMenuItem key={item.name} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import type { MenuItem } from './menu-items';
import { DefaultMenuItem } from './default-menu-item';

export function SectionsMenu({
  sections,
}: {
  sections: Record<string, MenuItem[]>;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2 overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {Object.keys(sections).map((section) => (
          <div key={section}>
            {section ? (
              <h5 className="px-4 pt-6 text-sm text-zinc-500 dark:text-zinc-400">
                {section}
              </h5>
            ) : undefined}
            <div className="grid grid-cols-2 gap-2 p-2">
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

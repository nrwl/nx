import type { MenuItem } from './menu-items';
import { DefaultMenuItem } from './default-menu-item';

export function TwoColumnsMenu({ items }: { items: MenuItem[] }): JSX.Element {
  return (
    <div className="flex flex-col gap-2 overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <div className="grid grid-cols-2 gap-2 p-2">
        {items
          .filter((i) => !i.isHighlight)
          .map((item) => (
            <DefaultMenuItem key={item.name} item={item} />
          ))}
        <div className="col-span-2 flex gap-2">
          {items
            .filter((i) => i.isHighlight)
            .map((item) => (
              <DefaultMenuItem key={item.name} item={item} />
            ))}
        </div>
      </div>
    </div>
  );
}

import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { MenuItem } from '@nrwl/nx-dev/models-menu';

export function ReferencesNavList({
  header,
  links,
}: {
  header: {
    title: string;
    icon: JSX.Element;
  };
  links: MenuItem;
}): JSX.Element {
  return (
    <nav className="relative">
      <h4 className="mb-5 flex items-center text-lg font-bold tracking-tight text-slate-700 lg:text-xl">
        {header.icon}
        {header.title}
      </h4>
      <ul className="space-y-0.5 text-sm">
        {links.itemList?.map((item, subIndex) => (
          <li key={[item.id, subIndex].join('-')}>
            <a
              href={item.path}
              className="group block flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/10 px-4 py-2 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900"
            >
              {item.name}
              <ChevronRightIcon className="h-4 w-4 transition-all group-hover:translate-x-2" />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

import { MenuItem } from '@nrwl/nx-dev/models-menu';

export function ReferencesNavList({
  header,
  links,
}: {
  header: {
    title: string;
    icon: JSX.Element;
  };
  links: MenuItem[];
}): JSX.Element {
  return (
    <nav className="relative">
      <h4 className="mb-5 flex items-center text-lg font-bold tracking-tight text-slate-700 lg:text-xl">
        {header.icon}
        {header.title}
      </h4>
      <ul className="space-y-3 border-l border-slate-100 text-sm lg:space-y-1">
        {links.map((item, subIndex) => (
          <li key={[item.id, subIndex].join('-')}>
            <a
              href={item.path}
              className="-ml-px block border-l border-transparent pl-4 text-slate-500 hover:border-slate-400 hover:text-slate-900"
            >
              {item.name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

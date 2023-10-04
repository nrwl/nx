import { iconsMap } from './icons-map';

export function ReferencesPackageCard(pkg: {
  id: string;
  name: string;
  path: string;
}): JSX.Element {
  return (
    <div className="flex items-center gap-4">
      <div className="ml-3 block flex-shrink-0">
        <img
          className="h-10 w-10 rounded-lg object-cover opacity-75"
          loading="lazy"
          src={iconsMap[pkg.id]}
          alt={pkg.name + ' illustration'}
          aria-hidden="true"
        />
      </div>
      <div>
        <h3 className="text-2xl font-bold text-slate-900 lg:text-3xl">
          {pkg.name}
        </h3>
      </div>
    </div>
  );
}

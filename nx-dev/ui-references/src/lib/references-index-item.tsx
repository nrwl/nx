import cx from 'classnames';
import { iconsMap } from './icons-map';

export function ReferencesIndexItem(pkg: {
  active: string;
  callback: (id: any) => any;
  id: string;
  name: string;
  path: string;
}): JSX.Element {
  return (
    <button
      onClick={() => pkg.callback(pkg.id)}
      className={cx(
        'group relative flex items-center justify-center gap-3 overflow-hidden rounded-lg border border-slate-200 px-3 py-2 text-slate-700 transition hover:bg-slate-50',
        pkg.active === pkg.id ? 'bg-slate-200' : ''
      )}
    >
      <img
        className="h-5 w-5 object-cover opacity-75"
        loading="lazy"
        src={iconsMap[pkg.id]}
        alt={pkg.name + ' illustration'}
        aria-hidden="true"
      />

      <span className="text-base font-medium">{pkg.name}</span>
    </button>
  );
}

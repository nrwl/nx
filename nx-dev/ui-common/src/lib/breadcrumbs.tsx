import { ChevronRightIcon } from '@heroicons/react/24/solid';
import classNames from 'classnames';

export function Breadcrumbs({ path }: { path: string }): JSX.Element {
  const cleanedPath = path.includes('?')
    ? path.slice(0, path.indexOf('?'))
    : path;
  const pages = [
    ...cleanedPath
      .split('/')
      .filter(Boolean)
      .map((segment, index, segments) => ({
        name: segment.includes('#')
          ? segment.slice(0, segment.indexOf('#'))
          : segment,
        // We do not have dedicated page view for executors & generators
        href: '/' + segments.slice(0, index + 1).join('/'),
        current: '/' + segments.slice(0, index + 1).join('/') === cleanedPath,
      })),
  ];

  if (pages.length === 1) {
    return <></>;
  }

  return (
    <div>
      <nav className="flex" aria-labelledby="breadcrumb">
        <ol role="list" className="flex items-center space-x-4">
          {pages.map((page, index) => (
            <li key={page.name.concat('-', index.toString())}>
              <div className="flex items-center">
                {!!index && (
                  <ChevronRightIcon
                    className="h-5 w-5 flex-shrink-0 text-slate-500"
                    aria-hidden="true"
                  />
                )}
                <a
                  href={page.href}
                  className={classNames(
                    'text-sm font-medium capitalize hover:text-slate-600',
                    page.current ? 'text-slate-600' : 'text-slate-400',
                    !!index ? 'ml-4' : ''
                  )}
                  aria-current={page.current ? 'page' : undefined}
                >
                  {page.name.replace(/-/gi, ' ')}
                </a>
              </div>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}

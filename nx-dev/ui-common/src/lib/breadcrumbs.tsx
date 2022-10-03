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
        href: ['executors', 'generators'].includes(segment)
          ? '/' + segments.slice(0, index).join('/') + '#' + segment
          : '/' + segments.slice(0, index + 1).join('/'),
        current: '/' + segments.slice(0, index + 1).join('/') === cleanedPath,
      })),
  ];
  const hasRef = path.includes('?') ? path.slice(0, path.indexOf('?')) : '';

  return (
    <div>
      <nav className="flex" aria-labelledby="breadcrumb">
        <ol role="list" className="flex items-center space-x-4">
          {pages.map((page, index) => (
            <li key={page.name}>
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
          {hasRef && (
            <li>
              <div className="flex items-center">
                <ChevronRightIcon
                  className="h-5 w-5 flex-shrink-0 text-slate-500"
                  aria-hidden="true"
                />
                <a
                  href={path}
                  className={classNames(
                    'text-sm font-medium hover:text-slate-800',
                    'ml-4 text-slate-500'
                  )}
                  aria-current="page"
                >
                  {hasRef}
                </a>
              </div>
            </li>
          )}
        </ol>
      </nav>
    </div>
  );
}

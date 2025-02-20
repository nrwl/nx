import { ChevronRightIcon } from '@heroicons/react/24/solid';
import { ProcessedDocument } from '@nx/nx-dev/models-document';
import classNames from 'classnames';

interface Crumb {
  id: string;
  name: string;
  href: string;
  current: boolean;
}

const sectionNames: Record<string, string> = {
  ci: 'CI',
  'extending-nx': 'Extending Nx',
  'nx-api': 'Nx API',
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Breadcrumbs({
  document,
  path,
}: {
  document?: ProcessedDocument;
  path?: string;
}): JSX.Element {
  let crumbs: Crumb[] = [];

  if (path) {
    const cleanedPath = path.includes('?')
      ? path.slice(0, path.indexOf('?'))
      : path;
    crumbs = [
      ...cleanedPath
        .split('/')
        .filter(Boolean)
        .map((segment, index, segments) => {
          const strippedName = segment.includes('#')
            ? segment.slice(0, segment.indexOf('#'))
            : segment;
          const name =
            sectionNames[strippedName] ||
            strippedName.split('-').map(capitalize).join(' ');
          return {
            id: segment,
            name,
            // We do not have dedicated page view for executors & generators
            href: '/' + segments.slice(0, index + 1).join('/'),
            current:
              '/' + segments.slice(0, index + 1).join('/') === cleanedPath,
          };
        }),
    ];
  }

  if (document && document.parentDocuments) {
    crumbs = document.parentDocuments.map((parentDocument, index) => ({
      id: parentDocument.id,
      name:
        parentDocument.name ||
        sectionNames[parentDocument.id] ||
        parentDocument.id.split('-').map(capitalize).join(' '),
      href: parentDocument.path,
      current: index + 1 === document.parentDocuments?.length,
    }));
  }

  if (crumbs.length < 2) {
    return <></>;
  }

  return (
    <div>
      <nav className="flex" aria-labelledby="breadcrumb">
        <ol role="list" className="flex flex-wrap items-center space-x-3">
          {crumbs.map((crumb, index) => (
            <li
              className="m-1 block"
              key={crumb.id.concat('-', index.toString())}
            >
              <div className="flex items-center">
                {!!index && (
                  <ChevronRightIcon
                    className="h-5 w-5 flex-shrink-0 text-slate-500"
                    aria-hidden="true"
                  />
                )}
                <a
                  href={crumb.href}
                  className={classNames(
                    'text-sm font-medium hover:text-slate-600',
                    crumb.current ? 'text-slate-600' : 'text-slate-400',
                    !!index ? 'ml-4' : ''
                  )}
                  aria-current={crumb.current ? 'page' : undefined}
                >
                  {crumb.name}
                </a>
              </div>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}

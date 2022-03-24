import { ChevronRightIcon } from '@heroicons/react/solid';
import classNames from 'classnames';

export function Breadcrumbs({
  pages,
}: {
  pages: { name: string; href: string; current: boolean }[];
}) {
  return (
    <nav className="flex" aria-label="Breadcrumb">
      <ol role="list" className="flex items-center space-x-4">
        {pages.map((page, index) => (
          <li key={page.name}>
            <div className="flex items-center">
              {!!index && (
                <ChevronRightIcon
                  className="h-5 w-5 flex-shrink-0 text-gray-500"
                  aria-hidden="true"
                />
              )}
              <a
                href={page.href}
                className={classNames(
                  'text-sm font-medium hover:text-gray-800',
                  page.current ? 'text-gray-800' : 'text-gray-500',
                  !!index ? 'ml-4' : ''
                )}
                aria-current={page.current ? 'page' : undefined}
              >
                {page.name}
              </a>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;

import {
  BookmarkAltIcon,
  ChipIcon,
  CogIcon,
  TerminalIcon,
} from '@heroicons/react/solid';
import { MenuItem } from '@nrwl/nx-dev/models-menu';
import { ReferencesNavList } from './references-nav-list';
import { ReferencesPackageCard } from './references-package-card';

export function ReferencesSection({
  section,
}: {
  section: MenuItem;
}): JSX.Element {
  const guides =
    section.itemList?.filter(
      (x) => !x.path?.includes('executors') && !x.path?.includes('generators')
    ) || [];
  const executors =
    section.itemList?.filter((x) => x.path?.includes('executors')) || [];
  const generators =
    section.itemList?.filter((x) => x.path?.includes('generators')) || [];
  return (
    <section
      id={section.id}
      className="relative py-2 md:grid md:grid-cols-3 md:gap-x-16"
    >
      <header className="md:col-span-1">
        <ReferencesPackageCard
          id={section.id}
          name={section.name as string}
          path={section.path as string}
        />
      </header>
      <div className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-3 sm:space-y-0 md:col-span-2 md:mt-0">
        {!!guides.length && (
          <ReferencesNavList
            header={{
              icon:
                section.id === 'nx' ? (
                  <TerminalIcon className="mr-2 h-5 w-5" aria-hidden="true" />
                ) : (
                  <BookmarkAltIcon
                    className="mr-2 h-5 w-5"
                    aria-hidden="true"
                  />
                ),
              title: section.id === 'nx' ? 'Commands' : 'Guides',
            }}
            links={guides}
          />
        )}

        {!!executors.length && (
          <ReferencesNavList
            header={{
              icon: <ChipIcon className="mr-2 h-5 w-5" aria-hidden="true" />,
              title: 'Executors',
            }}
            links={executors}
          />
        )}

        {!!generators.length && (
          <ReferencesNavList
            header={{
              icon: <CogIcon className="mr-2 h-5 w-5" aria-hidden="true" />,
              title: 'Generators',
            }}
            links={generators}
          />
        )}
      </div>
    </section>
  );
}

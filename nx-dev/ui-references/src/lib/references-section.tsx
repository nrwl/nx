import {
  BookmarkIcon,
  CogIcon,
  CommandLineIcon,
  CpuChipIcon,
} from '@heroicons/react/24/solid';
import { MenuItem } from '@nrwl/nx-dev/models-menu';
import { ReferencesNavList } from './references-nav-list';
import { ReferencesPackageCard } from './references-package-card';

export function ReferencesSection({
  section,
}: {
  section: MenuItem;
}): JSX.Element {
  const guides: MenuItem | null =
    section.itemList?.find((x) => x.id === section.id + '-guides') || null;
  const executors =
    section.itemList?.find((x) => x.id === section.id + '-executors') || null;
  const generators =
    section.itemList?.find((x) => x.id === section.id + '-generators') || null;

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
        {!!guides && (
          <ReferencesNavList
            header={{
              icon:
                section.id === 'nx' ? (
                  <CommandLineIcon
                    className="mr-2 h-5 w-5"
                    aria-hidden="true"
                  />
                ) : (
                  <BookmarkIcon className="mr-2 h-5 w-5" aria-hidden="true" />
                ),
              title: section.id === 'nx' ? 'Commands' : 'Guides',
            }}
            links={guides}
          />
        )}

        {!!executors && (
          <ReferencesNavList
            header={{
              icon: <CpuChipIcon className="mr-2 h-5 w-5" aria-hidden="true" />,
              title: executors.name,
            }}
            links={executors}
          />
        )}

        {!!generators && (
          <ReferencesNavList
            header={{
              icon: <CogIcon className="mr-2 h-5 w-5" aria-hidden="true" />,
              title: generators.name,
            }}
            links={generators}
          />
        )}
      </div>
    </section>
  );
}

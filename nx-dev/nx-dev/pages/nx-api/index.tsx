import { Heading1 } from '@nx/nx-dev/feature-package-schema-viewer';
import { getPackagesSections } from '@nx/nx-dev/data-access-menu';
import {
  filterMigrationPackages,
  sortCorePackagesFirst,
} from '@nx/nx-dev/data-access-packages';
import { Menu, MenuItem, MenuSection } from '@nx/nx-dev/models-menu';
import { IntrinsicPackageMetadata } from '@nx/nx-dev/models-package';
import {
  Breadcrumbs,
  DocumentationHeader,
  Footer,
  SidebarContainer,
} from '@nx/nx-dev/ui-common';
import { iconsMap } from '@nx/nx-dev/ui-references';
import { NextSeo } from 'next-seo';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMemo } from 'react';
import { menusApi } from '../../lib/menus.api';
import { useNavToggle } from '../../lib/navigation-toggle.effect';
import { nxPackagesApi } from '../../lib/packages.api';
import { ScrollableContent } from '@nx/ui-scrollable-content';

export default function Packages({
  packages,
  menu,
}: {
  packages: IntrinsicPackageMetadata[];
  menu: MenuItem[];
}): JSX.Element {
  const router = useRouter();
  const { toggleNav, navIsOpen } = useNavToggle();

  const vm: { menu: Menu; packages: IntrinsicPackageMetadata[] } = {
    menu: {
      sections: sortCorePackagesFirst<MenuSection>(
        getPackagesSections(menu),
        'id'
      ),
    },
    packages: useMemo(() => {
      return sortCorePackagesFirst<IntrinsicPackageMetadata>(
        filterMigrationPackages<IntrinsicPackageMetadata>(packages),
        'name'
      );
    }, [packages]),
  };

  return (
    <>
      <NextSeo
        title="Reference: Official Packages & API"
        description="Reference: Official Packages & API"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Reference: Official Packages & API',
          description: 'Reference: Official Packages & API',
          images: [
            {
              url: 'https://nx.dev/socials/nx-media.png',
              width: 1200,
              height: 600,
              alt: 'Nx: Smart Monorepos · Fast CI',
              type: 'image/png',
            },
          ],
          siteName: 'Nx',
          type: 'website',
        }}
      />
      <div id="shell" className="flex h-full flex-col">
        <div className="w-full flex-shrink-0">
          <DocumentationHeader isNavOpen={navIsOpen} toggleNav={toggleNav} />
        </div>
        <main
          id="main"
          role="main"
          className="flex h-full flex-1 overflow-y-hidden"
        >
          <SidebarContainer
            menu={vm.menu}
            navIsOpen={navIsOpen}
            toggleNav={toggleNav}
          />
          <ScrollableContent>
            <div className="mx-auto w-full grow items-stretch px-4 sm:px-6 lg:px-8 2xl:max-w-6xl">
              <div id="content-wrapper" className="w-full flex-auto flex-col">
                <div className="mb-6 pt-8">
                  <Breadcrumbs path={router.asPath} />
                </div>
                <div data-document="main">
                  <Heading1 title={'Official Packages Reference'} />

                  <section id="packages-section" className="py-1">
                    <p>
                      Read more about what Nx plugins are on our{' '}
                      <Link
                        href="/concepts/nx-plugins"
                        className="text-blue-600 transition-colors ease-out hover:text-blue-700 dark:text-sky-500 dark:hover:text-sky-400"
                        prefetch={false}
                      >
                        docs page.
                      </Link>
                    </p>
                  </section>
                  <section id="packages-section" className="py-6">
                    <nav
                      aria-labelledby="package-index-navigation"
                      className="relative mb-24 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5"
                    >
                      {vm.packages.map((pkg) => (
                        <Link
                          key={'ref-' + pkg.name}
                          href={pkg.path}
                          className="group relative flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50/40 p-4 text-sm capitalize shadow-sm transition hover:bg-slate-50 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                          prefetch={false}
                        >
                          <img
                            className="h-5 w-5 object-cover opacity-75 dark:invert"
                            loading="lazy"
                            src={iconsMap[pkg.name]}
                            alt={pkg.name + ' illustration'}
                            aria-hidden="true"
                          />
                          <span className="text-base font-medium">
                            {pkg.name.replace(/-/gi, ' ')}
                          </span>
                        </Link>
                      ))}
                    </nav>
                  </section>
                </div>
              </div>
            </div>
            <Footer />
          </ScrollableContent>
        </main>
      </div>
    </>
  );
}

export async function getStaticProps(): Promise<{
  props: {
    packages: IntrinsicPackageMetadata[];
    menu: MenuItem[];
  };
}> {
  return {
    props: {
      packages: nxPackagesApi.getRootPackageIndex(),
      menu: menusApi.getMenu('nx-api', ''),
    },
  };
}

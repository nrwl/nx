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
      const storybookIdx = packages.findIndex((p) => p.name === 'storybook');
      const packagesWithRspack = [
        ...packages.slice(0, storybookIdx),
        {
          description:
            'The Nx Plugin for Rspack contains executors and generators that support building applications using Rspack.',
          githubRoot: 'https://github.com/nrwl/nx/blob/master',
          name: 'rspack',
          packageName: '@nrwl/rspack',
          path: '/packages/rspack',
          root: '/packages/rspack',
          source: '/packages/rspack/src',
        },
        ...packages.slice(storybookIdx),
      ];
      return sortCorePackagesFirst<IntrinsicPackageMetadata>(
        filterMigrationPackages<IntrinsicPackageMetadata>(packagesWithRspack),
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
              alt: 'Nx: Smart, Fast and Extensible Build System',
              type: 'image/png',
            },
          ],
          siteName: 'NxDev',
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
          <SidebarContainer menu={vm.menu} navIsOpen={navIsOpen} />
          <div
            id="wrapper"
            data-testid="wrapper"
            className="relative flex flex-grow flex-col items-stretch justify-start overflow-y-scroll"
          >
            <div className="mx-auto w-full grow items-stretch px-4 sm:px-6 lg:px-8 2xl:max-w-6xl">
              <div id="content-wrapper" className="w-full flex-auto flex-col">
                <div className="mb-6 pt-8">
                  <Breadcrumbs path={router.asPath} />
                </div>
                <div data-document="main">
                  <Heading1 title={'Official Packages Reference'} />

                  <section id="packages-section" className="py-1">
                    <p>
                      In version 16, we have rescoped our packages to{' '}
                      <code>@nx/*</code> from <code>@nrwl/*</code>.{' '}
                      <a href="/recipes/other/rescope" className="underline">
                        Read more about the rescope ≫
                      </a>
                    </p>
                  </section>
                  <section id="packages-section" className="py-12">
                    <nav
                      aria-labelledby="package-index-navigation"
                      className="relative mb-24 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5"
                    >
                      {vm.packages.map((pkg) => (
                        <Link
                          key={'ref-' + pkg.name}
                          href={pkg.path}
                          className="group relative flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50/40 p-4 text-sm capitalize shadow-sm transition hover:bg-slate-50 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:bg-slate-800"
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
          </div>
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
      menu: menusApi.getMenu('packages', ''),
    },
  };
}

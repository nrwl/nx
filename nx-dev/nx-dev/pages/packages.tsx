import { sortCorePackagesFirst } from '@nrwl/nx-dev/data-access-packages';
import { MenuItem, MenuSection } from '@nrwl/nx-dev/models-menu';
import {
  Breadcrumbs,
  DocumentationHeader,
  Footer,
  SidebarContainer,
} from '@nrwl/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMemo } from 'react';
import { Heading1 } from '../../feature-package-schema-viewer/src/lib/ui/headings';
import { iconsMap } from '../../ui-references/src/lib/icons-map';
import { nxMenuApi } from '../lib/api';
import { useNavToggle } from '../lib/navigation-toggle.effect';

interface ReferencesProps {
  references: MenuSection;
}

export async function getStaticProps(): Promise<{ props: ReferencesProps }> {
  return {
    props: {
      references: nxMenuApi.getReferenceApiMenuSection(),
    },
  };
}

export default function Packages(props: ReferencesProps): JSX.Element {
  const router = useRouter();
  const { toggleNav, navIsOpen } = useNavToggle();
  const references: MenuItem[] = useMemo(
    () => sortCorePackagesFirst<MenuItem>(props.references.itemList),
    [props.references.itemList]
  );

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
              url: 'https://nx.dev/images/nx-media.jpg',
              width: 800,
              height: 421,
              alt: 'Nx: Smart, Fast and Extensible Build System',
              type: 'image/jpeg',
            },
          ],
          site_name: 'NxDev',
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
            menu={{ sections: references }}
            navIsOpen={navIsOpen}
          />
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
                <Heading1 title={'Official Packages Reference'} />

                <section id="packages-section" className="py-12">
                  <nav
                    aria-labelledby="package-index-navigation"
                    className="relative mb-24 grid grid-cols-2 gap-4 md:grid-cols-4"
                  >
                    {references.map((category: MenuItem, index, all) => (
                      <Link
                        key={'ref-' + category.id}
                        href={category.path as string}
                      >
                        <a className="group relative flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50/40 p-4 text-sm capitalize shadow-sm transition hover:bg-slate-50 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:bg-slate-800">
                          <img
                            className="h-5 w-5 object-cover opacity-75 dark:invert"
                            loading="lazy"
                            src={iconsMap[category.id]}
                            alt={category.name + ' illustration'}
                            aria-hidden="true"
                          />

                          <span className="text-base font-medium">
                            {category.name}
                          </span>
                        </a>
                      </Link>
                    ))}
                  </nav>
                </section>
              </div>
            </div>
            <Footer />
          </div>
        </main>
      </div>
    </>
  );
}

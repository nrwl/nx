import { SearchIcon } from '@heroicons/react/solid';
import { MenuItem, MenuSection } from '@nrwl/nx-dev/models-menu';
import { Footer, Header } from '@nrwl/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { ReferencesSection } from '../../ui-references/src/lib/references-section';
import { nxMenuApi } from '../lib/api';

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

export function References(props: ReferencesProps): JSX.Element {
  const router = useRouter();
  const nxPackageIds = ['nx', 'cli', 'workspace', 'devkit', 'nx-plugin'];
  const references = [
    ...nxPackageIds.map((id) =>
      props.references.itemList.find((pkg) => pkg.id === id)
    ),
    ...props.references.itemList.filter(
      (pkg) => !nxPackageIds.includes(pkg.id)
    ),
  ];
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <>
      <NextSeo
        title="Nx API References"
        description="Nx API References"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx API References',
          description: 'Nx API References',
          images: [
            {
              url: 'https://nx.dev/images/nx-media.jpg',
              width: 800,
              height: 400,
              alt: 'Nx: Smart, Fast and Extensible Build System',
              type: 'image/jpeg',
            },
          ],
          site_name: 'NxDev',
          type: 'website',
        }}
      />
      <Header useDarkBackground={false} />
      <main id="main" role="main">
        <div className="w-full">
          <article id="references" className="pt-16 sm:pt-24 lg:pt-32">
            <header className="mx-auto max-w-prose px-4 text-center sm:max-w-3xl sm:px-6 lg:px-8">
              <div>
                <h1 className="text-blue-nx-base text-base font-semibold uppercase tracking-wider">
                  <span className="sr-only">Nx </span> References
                </h1>
                <p className="mt-2 text-4xl font-extrabold tracking-tight text-slate-800 sm:text-6xl">
                  API & Packages / Official Plugins
                </p>
              </div>
            </header>
          </article>

          <div className="relative mx-auto flex max-w-7xl justify-end py-8 px-4 sm:px-6 md:px-8 lg:pt-32">
            <div>
              <label htmlFor="search" className="sr-only">
                Filter packages
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <SearchIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="search"
                  name="Filter packages"
                  className="focus:border-blue-nx-base focus:ring-blue-nx-base block w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:text-gray-900 focus:placeholder-gray-400 focus:outline-none focus:ring-1 sm:text-sm"
                  placeholder="Filter packages"
                  onChange={(event) => setSearchTerm(event.target.value)}
                  type="search"
                />
              </div>
            </div>
          </div>
          <div className="relative mx-auto max-w-7xl space-y-20 py-12 px-4 sm:px-6 md:px-8 lg:pt-16">
            {references
              .filter((pkg) =>
                !!searchTerm && !!pkg
                  ? pkg.id.toLowerCase().includes(searchTerm.toLowerCase())
                  : true
              )
              .map((category: MenuItem, index) => (
                <ReferencesSection
                  key={[category.id, index].join('-')}
                  section={category}
                />
              ))}
          </div>
        </div>
      </main>
      <Footer useDarkBackground={false} />
    </>
  );
}

export default References;

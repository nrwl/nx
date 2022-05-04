import { ChipIcon, CogIcon } from '@heroicons/react/solid';
import { Menu } from '@nrwl/nx-dev/models-menu';
import { PackageMetadata } from '@nrwl/nx-dev/models-package';
import { Sidebar } from '@nrwl/nx-dev/ui-common';
import cx from 'classnames';
import { NextSeo } from 'next-seo';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactComponentElement } from 'react';
import { getPublicPackageName } from './get-public-package-name';
import { Heading1, Heading2 } from './ui/headings';
import { Markdown } from './ui/markdown/markdown';

export function PackageSchemaList({
  pkg,
  menu,
  navIsOpen,
}: {
  pkg: PackageMetadata;
  menu: Menu;
  navIsOpen?: boolean;
}): ReactComponentElement<any> {
  const router = useRouter();

  const vm: {
    pkg: {
      name: string;
      description: string;
      githubUrl: string;
    };
    seo: { title: string; description: string; url: string; imageUrl: string };
  } = {
    pkg: {
      name: getPublicPackageName(pkg.name),
      description: pkg.description,
      githubUrl: pkg.githubRoot + pkg.root,
    },
    seo: {
      title: `${getPublicPackageName(pkg.name)} | Nx`,
      description: pkg.description,
      imageUrl: `https://nx.dev/images/open-graph/${router.asPath
        .replace('/', '')
        .replace(/\//gi, '-')}.jpg`,
      url: 'https://nx.dev' + router.asPath,
    },
  };

  return (
    <>
      <NextSeo
        title={vm.seo.title}
        openGraph={{
          url: vm.seo.url,
          title: vm.seo.title,
          description: vm.seo.description,
          images: [
            {
              url: vm.seo.imageUrl,
              width: 1600,
              height: 800,
              alt: 'Nx: Smart, Fast and Extensible Build System',
              type: 'image/jpeg',
            },
          ],
          site_name: 'Nx',
          type: 'website',
        }}
      />
      <div className="mx-auto w-full max-w-screen-lg">
        <div className="lg:flex">
          <Sidebar menu={menu} navIsOpen={navIsOpen} />
          <div
            id="content-wrapper"
            className={cx(
              'w-full min-w-0 flex-auto flex-col pt-16 md:pl-4 lg:static lg:max-h-full lg:overflow-visible',
              navIsOpen && 'fixed max-h-screen overflow-hidden'
            )}
          >
            <div className="min-w-0 flex-auto px-4 pt-8 pb-24 sm:px-6 lg:pb-16 xl:px-8">
              <div className="mb-8 flex w-full items-center space-x-2">
                <div className="w-full flex-grow">
                  <div className="relative inline-flex rounded-md border border-gray-200 bg-white px-4 py-2 text-xs font-medium uppercase text-gray-600">
                    Package
                  </div>
                </div>
                <div className="relative z-0 inline-flex flex-shrink-0">
                  <a
                    href={vm.pkg.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-hidden="true"
                    title="See package on Github"
                    className="focus:ring-blue-nx-base focus:border-blue-nx-base relative inline-flex items-center rounded-md border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1"
                  >
                    {vm.pkg.name}
                  </a>
                </div>
              </div>

              <Heading1 title={vm.pkg.name} />

              <Markdown content={vm.pkg.description} classes="mb-4" />

              <p className="mb-16">
                Here is a list of all the executors and generators available
                from this package.
              </p>

              <Heading2 title={'Executors'} />
              <ul role="list" className="divide-y divide-gray-200">
                {pkg.executors.map((executors) => (
                  <li
                    key={executors.name}
                    className="focus-within:ring-blue-nx-base relative flex px-2 py-4 transition focus-within:ring-2 focus-within:ring-offset-2 hover:bg-gray-50"
                  >
                    <ChipIcon
                      className="h-8 w-8 flex-shrink-0 rounded-full text-gray-300"
                      role="img"
                    />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        <Link
                          href={`/packages/${pkg.name}/executors/${executors.name}`}
                        >
                          <a className="focus:outline-none">
                            <span
                              className="absolute inset-0"
                              aria-hidden="true"
                            ></span>
                            {executors.name}
                          </a>
                        </Link>
                      </p>
                      <Markdown
                        content={executors.description}
                        classes="prose-sm"
                      />
                    </div>
                  </li>
                ))}
              </ul>

              <div className="h-12">{/* SPACER */}</div>
              <Heading2 title={'Generators'} />
              <ul role="list" className="divide-y divide-gray-200">
                {pkg.generators.map((generators) => (
                  <li
                    key={generators.name}
                    className="focus-within:ring-blue-nx-base relative flex px-2 py-4 transition focus-within:ring-2 focus-within:ring-offset-2 hover:bg-gray-50"
                  >
                    <CogIcon
                      className="h-8 w-8 flex-shrink-0 rounded-full text-gray-300"
                      role="img"
                    />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        <Link
                          href={`/packages/${pkg.name}/generators/${generators.name}`}
                        >
                          <a className="focus:outline-none">
                            <span
                              className="absolute inset-0"
                              aria-hidden="true"
                            ></span>
                            {generators.name}
                          </a>
                        </Link>
                      </p>
                      <Markdown
                        content={generators.description}
                        classes="prose-sm"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default PackageSchemaList;

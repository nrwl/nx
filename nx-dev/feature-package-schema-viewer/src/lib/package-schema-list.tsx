import { PackageMetadata } from '@nrwl/nx-dev/models-package';
import { Breadcrumbs } from '@nrwl/nx-dev/ui-common';
import { renderMarkdown } from '@nrwl/nx-dev/ui-markdoc';
import cx from 'classnames';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { ReactNode } from 'react';
import { Heading1 } from './ui/headings';
import { PackageReference } from './ui/package-reference';

export function PackageSchemaList({
  pkg,
}: {
  pkg: PackageMetadata;
}): JSX.Element {
  const router = useRouter();

  const vm: {
    pkg: {
      name: string;
      description: string;
      githubUrl: string;
      id: string;
      readme: { content: string; filePath: string };
    };
    seo: { title: string; description: string; url: string; imageUrl: string };
    markdown: ReactNode;
  } = {
    pkg: {
      name: pkg.packageName,
      description: pkg.description,
      githubUrl: pkg.githubRoot + pkg.root,
      id: pkg.name,
      get readme() {
        const hasOverview = pkg.documentation.find((d) => d.id === 'overview');
        return !!hasOverview
          ? {
              content: hasOverview.content,
              filePath: hasOverview.file,
            }
          : { content: '', filePath: '' };
      },
    },
    seo: {
      title: `${pkg.packageName} | Nx`,
      description: pkg.description,
      imageUrl: `https://nx.dev/images/open-graph/${router.asPath
        .replace('/', '')
        .replace(/\//gi, '-')}.jpg`,
      url: 'https://nx.dev' + router.asPath,
    },
    get markdown(): ReactNode {
      return renderMarkdown({
        content: this.pkg.readme.content,
        filePath: this.pkg.readme.filePath,
        data: {},
      });
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
          <div
            id="content-wrapper"
            className={cx(
              'w-full min-w-0 flex-auto flex-col pt-16 md:pl-4 lg:static lg:max-h-full lg:overflow-visible'
            )}
          >
            <div className="min-w-0 flex-auto px-4 pb-24 sm:px-6 lg:pb-16 xl:px-8">
              <div className="mb-12 block w-full">
                <Breadcrumbs path={router.asPath} />
              </div>
              <div className="mb-8 flex w-full items-center space-x-2">
                <div className="w-full flex-grow">
                  <div
                    className="relative inline-flex rounded-md border border-gray-200 bg-white px-4 py-2 text-xs font-medium uppercase text-gray-600"
                    aria-hidden="true"
                    data-tooltip="Installable package"
                  >
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
                    <svg
                      className="mr-2 h-4 w-4"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                      ></path>
                    </svg>
                    {vm.pkg.name}
                  </a>
                </div>
              </div>

              <Heading1 title={vm.pkg.name} />

              <div className="prose mb-16 max-w-none">{vm.markdown}</div>

              <PackageReference
                name={vm.pkg.id}
                executors={pkg.executors}
                generators={pkg.generators}
              ></PackageReference>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

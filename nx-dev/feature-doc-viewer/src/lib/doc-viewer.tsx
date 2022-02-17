import { DocumentData, Menu } from '@nrwl/nx-dev/data-access-documents';
import cx from 'classnames';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { ReactComponentElement } from 'react';
import Content from './content';
import Sidebar from './sidebar';

export interface DocumentationFeatureDocViewerProps {
  menu: Menu;
  document: DocumentData;
  toc: any;
  navIsOpen?: boolean;
}

export function DocViewer({
  document,
  menu,
  navIsOpen,
}: DocumentationFeatureDocViewerProps): ReactComponentElement<any> {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title={document.data.title + ' | Nx'}
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: document.data.title,
          description:
            'Next generation build system with first class monorepo support and powerful integrations.',
          images: [
            {
              url: router.asPath.includes('turbo-and-nx')
                ? 'https://nx.dev/images/nx-media-monorepo.jpg'
                : `https://nx.dev/images/open-graph/${router.asPath
                    .replace('/', '')
                    .replace(/\//gi, '-')}.jpg`,
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
            <Content document={document} />
            <div className="flex w-full items-center space-x-2 px-4 pt-24 pb-24 sm:px-6 lg:pb-16 xl:px-8">
              <div className="ml-4 flex h-0.5 w-full flex-grow rounded bg-slate-50" />
              <div className="relative z-0 inline-flex flex-shrink-0 rounded-md shadow-sm">
                <a
                  aria-hidden="true"
                  href="https://github.com/nrwl/nx/issues/new?assignees=&labels=type%3A+docs&template=3-documentation.md"
                  target="_blank"
                  rel="noreferrer"
                  title="Report an issue on Github"
                  className="focus:ring-blue-nx-base focus:border-blue-nx-base relative inline-flex items-center rounded-l-md border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1"
                >
                  Report an issue
                </a>
                <a
                  aria-hidden="true"
                  href={[
                    'https://github.com/nrwl/nx/blob/master',
                    document.filePath.replace(
                      'nx-dev/nx-dev/public/documentation',
                      'docs'
                    ),
                  ].join('/')}
                  target="_blank"
                  rel="noreferrer"
                  title="Edit this page on Github"
                  className="focus:ring-blue-nx-base focus:border-blue-nx-base relative -ml-px inline-flex items-center rounded-r-md border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1"
                >
                  Edit this page
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default DocViewer;

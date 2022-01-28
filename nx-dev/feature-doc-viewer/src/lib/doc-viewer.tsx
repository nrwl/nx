import React from 'react';
import cx from 'classnames';
import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import { DocumentData, Menu } from '@nrwl/nx-dev/data-access-documents';
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
}: DocumentationFeatureDocViewerProps) {
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
                : 'https://nx.dev/images/nx-media.jpg',
              width: 800,
              height: 400,
              alt: 'Nx: Smart, Fast and Extensible Build System',
              type: 'image/jpeg',
            },
          ],
          site_name: 'Nx',
          type: 'website',
        }}
      />
      <div className="w-full max-w-screen-lg mx-auto">
        <div className="lg:flex">
          <Sidebar menu={menu} navIsOpen={navIsOpen} />
          <div
            id="content-wrapper"
            className={cx(
              'min-w-0 w-full flex-auto flex-col lg:static lg:max-h-full lg:overflow-visible pt-16 md:pl-4',
              navIsOpen && 'overflow-hidden max-h-screen fixed'
            )}
          >
            <Content document={document} />
            <div className="flex items-center space-x-2 w-full px-4 sm:px-6 xl:px-8 pt-24 pb-24 lg:pb-16">
              <div className="ml-4 flex flex-grow h-0.5 w-full bg-slate-50 rounded" />
              <div className="flex-shrink-0 relative z-0 inline-flex shadow-sm rounded-md">
                <a
                  aria-hidden="true"
                  href="https://github.com/nrwl/nx/issues/new?assignees=&labels=type%3A+docs&template=3-documentation.md"
                  target="_blank"
                  rel="noreferrer"
                  title="Report an issue on Github"
                  className="relative inline-flex items-center px-4 py-2 rounded-l-md border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-blue-nx-base focus:border-blue-nx-base"
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
                  className="-ml-px relative inline-flex items-center px-4 py-2 rounded-r-md border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-blue-nx-base focus:border-blue-nx-base"
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

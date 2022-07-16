import { DocumentData } from '@nrwl/nx-dev/models-document';
import { Menu } from '@nrwl/nx-dev/models-menu';
import { Breadcrumbs, Footer, SidebarContainer } from '@nrwl/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import { Content } from './content';

export interface DocumentationFeatureDocViewerProps {
  menu: Menu;
  document: DocumentData;
  toc: any;
  navIsOpen: boolean;
}

export function DocViewer({
  document,
  menu,
  navIsOpen,
}: DocumentationFeatureDocViewerProps): JSX.Element {
  const wrapperElement = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      if (url.includes('#')) return;
      if (!wrapperElement) return;

      (wrapperElement as any).current.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth',
      });
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => router.events.off('routeChangeComplete', handleRouteChange);
  }, [router, wrapperElement]);

  return (
    <>
      <NextSeo
        title={document.data.title + ' | Nx'}
        description={
          document.data.description ??
          'Next generation build system with first class monorepo support and powerful integrations.'
        }
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: document.data.title,
          description:
            document.data.description ??
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
      <SidebarContainer menu={menu} navIsOpen={navIsOpen} />
      <div
        ref={wrapperElement}
        id="wrapper"
        data-testid="wrapper"
        className="relative flex flex-grow flex-col items-stretch justify-start overflow-y-scroll"
      >
        <div className="mx-auto w-full grow items-stretch px-4 sm:px-6 lg:px-8 2xl:max-w-6xl">
          <div id="content-wrapper" className="w-full flex-auto flex-col">
            <div className="mb-6 pt-8">
              <Breadcrumbs path={router.asPath} />
            </div>
            <Content document={document} />
            <div className="flex w-full items-center space-x-2 pt-24 pb-24 sm:px-6 lg:pb-16 xl:px-8">
              <div className="ml-4 flex h-0.5 w-full flex-grow rounded bg-slate-50 dark:bg-slate-800/60" />
              <div className="relative z-0 inline-flex flex-shrink-0 rounded-md shadow-sm">
                <a
                  aria-hidden="true"
                  href="https://github.com/nrwl/nx/issues/new?assignees=&labels=type%3A+docs&template=3-documentation.md"
                  target="_blank"
                  rel="noreferrer"
                  title="Report an issue on Github"
                  className="focus:ring-blue-nx-base focus:border-blue-nx-base relative inline-flex items-center rounded-l-md border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800"
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
                  className="focus:ring-blue-nx-base focus:border-blue-nx-base relative -ml-px inline-flex items-center rounded-r-md border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Edit this page
                </a>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}

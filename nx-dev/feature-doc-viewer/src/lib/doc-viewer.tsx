import {
  categorizeRelatedDocuments,
  generateRelatedDocumentsTemplate,
  ProcessedDocument,
  RelatedDocument,
} from '@nrwl/nx-dev/models-document';
import { Breadcrumbs, Footer } from '@nrwl/nx-dev/ui-common';
import { renderMarkdown } from '@nrwl/nx-dev/ui-markdoc';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';

export function DocViewer({
  document,
  relatedDocuments,
}: {
  document: ProcessedDocument;
  relatedDocuments: RelatedDocument[];
}): JSX.Element {
  const router = useRouter();

  const { metadata, node } = renderMarkdown(document.content.toString(), {
    filePath: document.filePath,
  });

  const vm = {
    title: metadata['title'] ?? document.name,
    description: metadata['description'] ?? document.description,
    content: node,
    relatedContent: renderMarkdown(
      generateRelatedDocumentsTemplate(
        categorizeRelatedDocuments(relatedDocuments)
      ),
      {
        filePath: '',
      }
    ).node,
  };

  return (
    <>
      <NextSeo
        title={vm.title + ' | Nx'}
        description={
          vm.description ??
          'Next generation build system with first class monorepo support and powerful integrations.'
        }
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: vm.title,
          description:
            vm.description ??
            'Next generation build system with first class monorepo support and powerful integrations.',
          images: [
            {
              url: router.asPath.includes('turbo-and-nx')
                ? 'https://nx.dev/socials/nx-media-monorepo.jpg'
                : `https://nx.dev/images/open-graph/${router.asPath
                    .replace('/', '')
                    .replace(/\//gi, '-')}.jpg`,
              width: 1600,
              height: 800,
              alt: 'Nx: Smart, Fast and Extensible Build System',
              type: 'image/jpeg',
            },
          ],
          siteName: 'Nx',
          type: 'website',
        }}
      />

      <div className="mx-auto w-full grow items-stretch px-4 sm:px-6 lg:px-8 2xl:max-w-6xl">
        <div id="content-wrapper" className="w-full flex-auto flex-col">
          <div className="mb-6 pt-8">
            <Breadcrumbs path={router.asPath} />
          </div>
          <div className="min-w-0 flex-auto pb-24 lg:pb-16">
            {/*MAIN CONTENT*/}
            <div
              data-document="main"
              className="prose prose-slate dark:prose-invert max-w-none"
            >
              {vm.content}
            </div>
            {/*RELATED CONTENT*/}
            <div
              data-document="related"
              className="prose prose-slate dark:prose-invert max-w-none"
            >
              {vm.relatedContent}
            </div>
          </div>
          <div className="flex w-full items-center space-x-2 pt-24 pb-24 sm:px-6 lg:pb-16 xl:px-8">
            <div className="ml-4 flex h-0.5 w-full flex-grow rounded bg-slate-50 dark:bg-slate-800/60" />
            <div className="relative z-0 inline-flex flex-shrink-0 rounded-md shadow-sm">
              <a
                aria-hidden="true"
                href="https://github.com/nrwl/nx/issues/new?assignees=&labels=type%3A+docs&template=3-documentation.md"
                target="_blank"
                rel="noreferrer"
                title="Report an issue on Github"
                className="relative inline-flex items-center rounded-l-md border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 focus-within:ring-blue-500 hover:bg-slate-50 focus:z-10 focus:outline-none focus:ring-1 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:focus-within:ring-sky-500 dark:hover:bg-slate-800"
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
                className="relative -ml-px inline-flex items-center rounded-r-md border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 focus-within:ring-blue-500 hover:bg-slate-50 focus:z-10 focus:outline-none focus:ring-1 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:focus-within:ring-sky-500 dark:hover:bg-slate-800"
              >
                Edit this page
              </a>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

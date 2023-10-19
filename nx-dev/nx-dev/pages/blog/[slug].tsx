import { GetStaticProps, GetStaticPaths } from 'next';
import { blogApi } from '../../lib/blog.api';
import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';
import { renderMarkdown } from '@nx/nx-dev/ui-markdoc';
import { NextSeo } from 'next-seo';
import { Footer, Header } from '@nx/nx-dev/ui-common';
import { cx } from '@nx/nx-dev/ui-primitives';
import { BlogAuthors } from '../../lib/blog/authors';

interface BlogPostDetailProps {
  post: BlogPostDataEntry;
}

export default function BlogPostDetail({ post }: BlogPostDetailProps) {
  const { node } = renderMarkdown(post.content, {
    filePath: post.filePath ?? '',
  });

  return (
    <>
      <NextSeo
        title="Nx Blog"
        description="Latest news from the Nx & Nx Cloud core team"
        openGraph={{
          url: 'https://nx.dev', // + router.asPath,
          title: 'Nx Blog',
          description:
            'Stay updated with the latest news, articles, and updates from the Nx & Nx Cloud team.',
          images: [
            {
              url: 'https://nx.dev/socials/nx-media.png',
              width: 800,
              height: 421,
              alt: 'Nx: Smart, Fast and Extensible Build System',
              type: 'image/jpeg',
            },
          ],
          siteName: 'NxDev',
          type: 'website',
        }}
      />
      <Header />
      <div className="mx-auto w-full grow items-stretch">
        <div
          id="content-wrapper"
          className="py-8  dark:bg-slate-800/40 w-full flex-auto flex-col"
        >
          <div className="mb-6 pt-8">
            {/* <Breadcrumbs path={router.asPath} /> */}
          </div>
          <header className="max-w-3xl mx-auto text-center flex flex-col items-center justify-center">
            <h1 className="prose prose-slate dark:prose-invert text-5xl font-bold mb-4">
              {post.frontmatter.title}
            </h1>
            <BlogAuthors authors={post.frontmatter.authors} />
          </header>
          {post.frontmatter.cover_image && (
            <div className="max-w-screen-lg mx-auto mt-4 overflow-hidden rounded-none lg:rounded-lg">
              <img src={post.frontmatter.cover_image} alt="" />
            </div>
          )}
          <div className="max-w-3xl mx-auto min-w-0 flex-auto pb-24 lg:pb-16">
            {/*MAIN CONTENT*/}
            <div className="relative">
              <div
                data-document="main"
                className={cx(
                  'prose prose-lg prose-slate dark:prose-invert w-full max-w-none 2xl:max-w-4xl'
                  // { 'xl:max-w-2xl': !hideTableOfContent }
                )}
              >
                {node}
              </div>
              {/* {!hideTableOfContent && (
                <div
                  className={cx(
                    'fixed top-36 right-[max(2rem,calc(50%-55rem))] z-20 hidden w-60 overflow-y-auto bg-white py-10 text-sm dark:bg-slate-900 xl:block'
                  )}
                >
                  <TableOfContents
                    elementRef={ref}
                    path={router.basePath}
                    headings={vm.tableOfContent}
                  >
                    {widgetData.githubStarsCount > 0 && (
                      <GitHubStarWidget
                        starsCount={widgetData.githubStarsCount}
                      />
                    )}
                  </TableOfContents>
                </div>
              )}*/}
            </div>
          </div>
          {/* <div className="flex w-full items-center space-x-2 pt-24 pb-24 sm:px-6 lg:pb-16 xl:px-8">
            <div className="ml-4 flex h-0.5 w-full flex-grow rounded bg-slate-50 dark:bg-slate-800/60" />
            <div className="relative z-0 inline-flex flex-shrink-0 rounded-md shadow-sm">
              <a
                aria-hidden="true"
                href="https://github.com/nrwl/nx/issues/new?assignees=&labels=type%3A+docs&template=3-documentation.md"
                target="_blank"
                rel="noreferrer"
                title="Report an issue on GitHub"
                className={`relative inline-flex items-center rounded-l-md ${
                  // If there is no file path for this page then don't show edit button.
                  document.filePath ? '' : 'rounded-r-md '
                }border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 focus-within:ring-blue-500 hover:bg-slate-50 focus:z-10 focus:outline-none focus:ring-1 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:focus-within:ring-sky-500 dark:hover:bg-slate-800`}
              >
                Report an issue
              </a>
              {document.filePath ? (
                <a
                  aria-hidden="true"
                  href={[
                    'https://github.com/nrwl/nx/blob/master',
                    document.filePath
                      .replace('nx-dev/nx-dev/public/documentation', 'docs')
                      .replace('public/documentation', 'docs'),
                  ].join('/')}
                  target="_blank"
                  rel="noreferrer"
                  title="Edit this page on GitHub"
                  className="relative -ml-px inline-flex items-center rounded-r-md border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 focus-within:ring-blue-500 hover:bg-slate-50 focus:z-10 focus:outline-none focus:ring-1 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:focus-within:ring-sky-500 dark:hover:bg-slate-800"
                >
                  Edit this page
                </a>
              ) : null}
            </div>
          </div> */}
        </div>
      </div>
      <Footer />
    </>
  );
}

export const getStaticProps: GetStaticProps = async (context) => {
  // optimize s.t. we don't read the FS multiple times; for now it's ok
  const posts = await blogApi.getBlogPosts();
  const post = posts.find((p) => p.slug === context.params?.slug);

  return {
    props: {
      post,
    },
  };
};

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await blogApi.getBlogPosts();

  const paths = posts.map((post) => ({
    params: { slug: post.slug },
  }));

  return { paths, fallback: false };
};

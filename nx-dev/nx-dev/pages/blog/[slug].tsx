import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeftIcon } from '@heroicons/react/24/solid';
import { GetStaticProps, GetStaticPaths } from 'next';
import { blogApi } from '../../lib/blog.api';
import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';
import { renderMarkdown } from '@nx/nx-dev/ui-markdoc';
import { NextSeo } from 'next-seo';
import { Footer, Header } from '@nx/nx-dev/ui-common';
import { BlogAuthors } from '@nx/nx-dev/ui-blog';

interface BlogPostDetailProps {
  post: BlogPostDataEntry;
}

export default function BlogPostDetail({ post }: BlogPostDetailProps) {
  const { node } = renderMarkdown(post.content, {
    filePath: post.filePath ?? '',
  });

  const formattedDate = new Date(post.date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <>
      <NextSeo
        title={`${post.title} | Nx Blog`}
        description="Latest news from the Nx & Nx Cloud core team"
        openGraph={{
          url: 'https://nx.dev', // + router.asPath,
          title: post.title,
          description: post.description,
          images: [
            {
              url: post.cover_image
                ? `https://nx.dev${post.cover_image}`
                : 'https://nx.dev/socials/nx-media.png',
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
      <main id="main" role="main" className="w-full py-8">
        <div className="mx-auto mb-8 flex max-w-screen-xl px-4 lg:px-8">
          <Link
            href="/blog"
            className="flex w-16 items-center text-slate-400 hover:text-slate-600"
          >
            <ChevronLeftIcon className="mr-1 h-4 w-4" />
            Blog
          </Link>
          <div className="flex flex-1 items-center justify-end text-right sm:justify-center sm:text-center">
            <BlogAuthors authors={post.authors} />
            <span className="ml-3 text-slate-500">{formattedDate}</span>
          </div>
          <div className="hidden w-16 sm:block" />
        </div>
        <div id="content-wrapper">
          <header className="mx-auto mb-16 mt-8 max-w-3xl px-4 lg:px-0">
            <h1 className="prose prose-slate dark:prose-invert text-center text-5xl font-semibold">
              {post.title}
            </h1>
          </header>
          {post.cover_image && (
            <div className="mx-auto mb-16 aspect-[1.9] w-full max-w-screen-md">
              <Image
                className="h-full w-full object-cover"
                src={post.cover_image}
                alt=""
                width={1400}
                height={735}
              />
            </div>
          )}
          <div className="mx-auto min-w-0 max-w-3xl flex-auto px-4 pb-24 lg:px-0 lg:pb-16">
            <div className="relative">
              <div
                data-document="main"
                className="prose prose-lg prose-slate dark:prose-invert w-full max-w-none 2xl:max-w-4xl"
              >
                {node}
              </div>
            </div>
          </div>
        </div>
      </main>
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

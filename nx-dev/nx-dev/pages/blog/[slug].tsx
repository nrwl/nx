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
        <div className="max-w-screen-xl mx-auto flex mb-8 px-4 lg:px-8">
          <Link
            href="/blog"
            className="w-16 flex items-center hover:text-slate-600 text-slate-400"
          >
            <ChevronLeftIcon className="h-4 w-4 mr-1" />
            Blog
          </Link>
          <div className="flex flex-1 items-center justify-end text-right sm:justify-center sm:text-center">
            <BlogAuthors authors={post.authors} />
            <span className="ml-3 text-slate-500">{formattedDate}</span>
          </div>
          <div className="w-16 hidden sm:block" />
        </div>
        <div id="content-wrapper">
          <header className="max-w-3xl mx-auto mt-8 mb-16 px-4 lg:px-0">
            <h1 className="prose prose-slate dark:prose-invert text-5xl font-semibold text-center">
              {post.title}
            </h1>
          </header>
          {post.cover_image && (
            <div className="max-w-screen-lg mx-auto mb-16 w-full aspect-[1.9]">
              <Image
                className="w-full h-full object-cover"
                src={post.cover_image}
                alt=""
                width={1400}
                height={735}
              />
            </div>
          )}
          <div className="max-w-3xl mx-auto min-w-0 flex-auto pb-24 lg:pb-16 px-4 lg:px-0">
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

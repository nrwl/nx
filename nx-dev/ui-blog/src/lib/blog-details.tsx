import Link from 'next/link';
import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';
import Image from 'next/image';
import { BlogAuthors } from './authors';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { renderMarkdown } from '@nx/nx-dev/ui-markdoc';

export interface BlogDetailsProps {
  post: BlogPostDataEntry;
}
export function BlogDetails({ post }: BlogDetailsProps) {
  const { node } = renderMarkdown(post.content, {
    filePath: post.filePath ?? '',
  });

  const formattedDate = new Date(post.date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
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
          <h1 className="text-center text-4xl font-semibold text-slate-900 dark:text-white">
            {post.title}
          </h1>
        </header>
        {post.cover_image && (
          <div className="mx-auto mb-16 aspect-[1.9] w-full max-w-screen-md">
            <Image
              className="h-full w-full object-cover md:rounded-md"
              src={post.cover_image}
              alt={post.title}
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
  );
}

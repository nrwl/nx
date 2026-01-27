import Link from 'next/link';
import { BlogPostDataEntry } from '@nx/nx-dev-data-access-documents/node-only';
import { BlogAuthors } from './authors';

export interface MoreBlogsProps {
  blogs: BlogPostDataEntry[];
}

export function MoreBlogs({ blogs }: MoreBlogsProps) {
  return (
    <>
      <div className="mx-auto">
        {blogs?.map((post) => {
          const formattedDate = new Date(post.date).toLocaleDateString(
            'en-US',
            {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            }
          );
          const tags = post.tags;
          return (
            <Link
              href={`/blog/${post.slug}`}
              key={post.slug}
              className="relative flex items-center gap-6 border-b border-zinc-200 py-5 text-sm before:absolute before:inset-x-[-16px] before:inset-y-[-2px] before:z-[-1] before:rounded-xl before:bg-zinc-200 before:opacity-0 last:border-0 before:hover:opacity-100 dark:border-zinc-800 dark:before:bg-zinc-800/50"
              prefetch={false}
            >
              <span className="w-1/2 flex-none text-balance font-medium text-zinc-500 sm:w-5/12 dark:text-white">
                {post.title}
              </span>
              <span className="w-1/2 flex-none sm:w-3/12">
                {tags.join(', ')}
              </span>
              <span className="hidden w-2/12 flex-none sm:inline-block">
                {formattedDate}
              </span>
              <span className="hidden flex-1 overflow-hidden sm:inline-block">
                <BlogAuthors authors={post.authors} showAuthorDetails={false} />
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}

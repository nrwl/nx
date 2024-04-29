import Link from 'next/link';
import { cx } from '@nx/nx-dev/ui-primitives';
import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';
import { BlogAuthors } from './authors';
import { ImageTheme } from '@nx/nx-dev/ui-common';

export interface BlogEntryProps {
  post: BlogPostDataEntry;
}

export function BlogEntry({ post }: BlogEntryProps) {
  return (
    <div
      className={cx(
        'flex h-full flex-col overflow-hidden rounded-2xl',
        'border border-slate-200 dark:border-slate-800 dark:bg-slate-900',
        'shadow-[0_1px_4px_-1px_rgba(0,0,0,0.09)] transition-all duration-300 ease-in-out dark:shadow-[0_2px_4px_rgba(0,0,0,0.1)]',
        'transform-gpu hover:scale-[1.02] hover:shadow-lg dark:hover:shadow-[0_7px_32px_rgba(0,0,0,0.35)]'
      )}
    >
      <Link href={`/blog/${post.slug}`}>
        {post.cover_image && (
          <div className="mb-4 aspect-[1.9] w-full">
            <ImageTheme
              quality={100}
              className="h-full w-full object-cover"
              lightSrc={post.cover_image}
              darkSrc={post.cover_image}
              alt=""
              width={1400}
              height={735}
            />
          </div>
        )}
        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="mb-2 flex w-full items-start justify-between pt-2">
            <BlogAuthors authors={post.authors} />
          </div>
          <span className="flex-1 text-balance text-lg font-semibold text-gray-900 dark:text-white">
            {post.title}
          </span>
        </div>
      </Link>
    </div>
  );
}

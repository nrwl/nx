import Image from 'next/image';
import Link from 'next/link';
import { cx } from '@nx/nx-dev/ui-primitives';
import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';
import { BlogAuthors } from './authors';

export interface BlogEntryProps {
  post: BlogPostDataEntry;
}

export function BlogEntry({ post }: BlogEntryProps) {
  const formattedDate = new Date(post.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className={cx(
        'h-full flex flex-col rounded-2xl overflow-hidden',
        'border-slate-200 border dark:border-slate-800 dark:bg-slate-900',
        'transition-all duration-300 ease-in-out',
        'hover:shadow-lg dark:hover:shadow-[0_7px_32px_rgba(0,0,0,0.35)] hover:scale-[1.02] transform-gpu'
      )}
    >
      <Link href={`/blog/${post.slug}`}>
        {post.cover_image && (
          <div className="w-full aspect-[1.9] mb-4">
            <Image
              quality={100}
              className="h-full w-full object-cover"
              src={post.cover_image}
              alt=""
              width={1400}
              height={735}
            />
          </div>
        )}
        <div className="px-4 pb-4 flex flex-col gap-4">
          <div className="flex items-start justify-between w-full pt-2 mb-2">
            <BlogAuthors authors={post.authors} />
          </div>
          <span className="text-lg flex-1 text-balance font-semibold text-gray-900 dark:text-white">
            {post.title}
          </span>
        </div>
      </Link>
    </div>
  );
}

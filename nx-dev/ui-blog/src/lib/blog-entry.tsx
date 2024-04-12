import Image from 'next/image';
import Link from 'next/link';
import { cx } from '@nx/nx-dev/ui-primitives';
import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';
import { BlogAuthors } from './authors';

export interface BlogEntryProps {
  blogpost: BlogPostDataEntry;
  showImage?: boolean;
}

export function BlogEntry({ blogpost, showImage }: BlogEntryProps) {
  const formattedDate = new Date(blogpost.frontmatter.date).toLocaleDateString(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }
  );

  return (
    <div
      className={cx(
        'rounded-2xl overflow-hidden pb-4',
        'border-slate-300 border dark:border-slate-700 dark:bg-slate-900',
        'transition-all duration-300 ease-in-out h-full',
        'hover:shadow-lg hover:scale-[1.02] transform-gpu'
      )}
    >
      <Link href={`/blog/${blogpost.slug}`}>
        {showImage && blogpost.frontmatter.cover_image && (
          <Image
            className="mb-4 object-cover"
            src={blogpost.frontmatter.cover_image}
            alt=""
            width={768}
            height={372}
          />
        )}
        <div className="px-4">
          <div className="flex items-start justify-between w-full pt-2 mb-2">
            <BlogAuthors authors={blogpost.frontmatter.authors} />
            <span className="flex-1 ml-3">{formattedDate}</span>
          </div>
          <span className="text-2xl font-semibold text-gray-900 dark:text-white">
            {blogpost.frontmatter.title}
          </span>
        </div>
      </Link>
    </div>
  );
}

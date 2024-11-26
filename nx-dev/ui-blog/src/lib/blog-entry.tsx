import Link from 'next/link';
import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';
import { BlogAuthors } from './authors';
import Image from 'next/image';

export interface BlogEntryProps {
  post: BlogPostDataEntry;
}

export function BlogEntry({ post }: BlogEntryProps) {
  return (
    <div className="relative flex h-full transform-gpu flex-col overflow-hidden rounded-2xl border border-slate-200 shadow transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-lg dark:border-slate-800">
      {post.cover_image && (
        <div className="aspect-[1.7] w-full">
          <Image
            quality={100}
            className="h-full w-full object-cover"
            src={post.cover_image}
            alt={post.title}
            width={1400}
            height={735}
          />
        </div>
      )}
      <div className="flex flex-col gap-1 p-4">
        <BlogAuthors authors={post.authors} />
        <Link
          href={`/blog/${post.slug}`}
          title={post.title}
          className="text-balance text-lg font-semibold text-slate-900 dark:text-white"
          prefetch={false}
        >
          <span className="absolute inset-0" aria-hidden="true" />
          {post.title}
        </Link>
      </div>
    </div>
  );
}

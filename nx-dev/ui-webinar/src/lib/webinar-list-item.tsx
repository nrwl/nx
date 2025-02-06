import { BlogAuthors } from '@nx/nx-dev/ui-blog';
import Link from 'next/link';
import type { WebinarDataEntry } from '@nx/nx-dev/data-access-documents/node-only';

export interface WebinarListItemProps {
  webinar: WebinarDataEntry;
  episode: number;
}
export function WebinarListItem({ webinar, episode }: WebinarListItemProps) {
  const formattedDate = new Date(webinar.date).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
  return (
    <Link
      href={`/blog/${webinar.slug}`}
      key={webinar.slug}
      className="relative flex items-center gap-6 border-b border-slate-200 py-5 text-sm before:absolute before:inset-x-[-16px] before:inset-y-[-2px] before:z-[-1] before:rounded-xl before:bg-slate-200 before:opacity-0 last:border-0 before:hover:opacity-100 dark:border-slate-800 dark:before:bg-slate-800/50"
      prefetch={false}
    >
      <span className="w-1/2 flex-none text-balance text-slate-500 sm:w-8/12 dark:text-white">
        {webinar.title}
      </span>
      <span className="hidden w-2/12 flex-none sm:inline-block">
        <time dateTime={webinar.date}>{formattedDate}</time>
      </span>
      <span className="hidden flex-1 overflow-hidden sm:inline-block">
        <BlogAuthors authors={webinar.authors} showAuthorDetails={false} />
      </span>
    </Link>
  );
}

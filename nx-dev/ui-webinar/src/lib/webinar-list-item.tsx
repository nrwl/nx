import { BlogAuthors } from '@nx/nx-dev-ui-blog';
import Link from 'next/link';
import type { WebinarDataEntry } from '@nx/nx-dev-data-access-documents/node-only';

export interface WebinarListItemProps {
  webinar: WebinarDataEntry;
  episode: number;
}
export function WebinarListItem({ webinar, episode }: WebinarListItemProps) {
  const formattedDate = new Date(webinar.eventDate || '').toLocaleDateString(
    'en-US',
    {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }
  );
  const authorsList = (
    webinar.authors.length > 1
      ? webinar.authors.map((a, i) =>
          i === webinar.authors.length - 1 ? 'and ' + a.name : a.name
        )
      : webinar.authors.map((a) => a.name)
  ).join(', ');
  const link = webinar.registrationUrl || '';
  return (
    <div
      key={webinar.slug}
      className="border-b border-slate-200 py-5 text-sm last:border-0 dark:border-slate-800 dark:before:bg-slate-800/50"
    >
      <Link href={link} prefetch={false}>
        <h3 className="text-balance text-lg text-slate-500 sm:w-8/12 dark:text-white">
          {webinar.title}
        </h3>
      </Link>
      <span className="my-4 block">
        <time dateTime={webinar.date}>{formattedDate}</time>
      </span>
      <span className="my-4 block">
        <span className="inline-block">
          <BlogAuthors authors={webinar.authors} showAuthorDetails={false} />
        </span>
        <span className="mx-2 inline-block">{authorsList}</span>
      </span>
      <p className="my-2">{webinar.description}</p>
      <Link href={link} prefetch={false}>
        <span className="my-4 text-balance text-slate-500 sm:w-8/12 dark:text-white">
          {webinar.status === 'Past - Ungated'
            ? 'Watch the recording'
            : 'Sign up to view the recording'}
        </span>
      </Link>
    </div>
  );
}

import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';
import { BlogAuthors } from '@nx/nx-dev/ui-blog';
import Link from 'next/link';

export interface PodcastListProps {
  podcasts: BlogPostDataEntry[];
}

export function PodcastList({ podcasts }: PodcastListProps): JSX.Element {
  return podcasts.length < 1 ? (
    <></>
  ) : (
    <>
      <div className="mx-auto mb-8 mt-20 border-b-2 border-slate-300 pb-3 text-sm dark:border-slate-700">
        <h2 className="font-semibold">Podcasts</h2>
      </div>
      <div className="mx-auto">
        {podcasts?.map((post) => {
          const formattedDate = new Date(post.date).toLocaleDateString(
            'en-US',
            {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            }
          );
          return (
            <Link
              href={`/blog/${post.slug}`}
              key={post.slug}
              className="relative flex items-center gap-6 border-b border-slate-200 py-5 text-sm before:absolute before:inset-x-[-16px] before:inset-y-[-2px] before:z-[-1] before:rounded-xl before:bg-slate-200 before:opacity-0 last:border-0 before:hover:opacity-100 dark:border-slate-800 dark:before:bg-slate-800/50"
              prefetch={false}
            >
              <span className="w-1/2 flex-none text-balance text-lg text-slate-500 sm:w-8/12 dark:text-white">
                Episode {post.episode}: {post.title}
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

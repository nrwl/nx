import { WebinarDataEntry } from '@nx/nx-dev/data-access-documents/node-only';
import { BlogEntry } from '@nx/nx-dev/ui-blog';
import { WebinarListItem } from './webinar-list-item';

export interface WebinarListProps {
  webinars: WebinarDataEntry[];
}

export function WebinarList({ webinars }: WebinarListProps): JSX.Element {
  return webinars.length < 1 ? (
    <div>
      <h2 className="mt-32 text-center text-xl font-semibold text-slate-500 sm:text-2xl xl:mb-24 dark:text-white ">
        No webinars as yet but stay tuned!
      </h2>
    </div>
  ) : (
    <div className="mx-auto max-w-7xl px-8">
      {webinars
        .filter((w) => w.status === 'Upcoming')
        .map((webinar, index) => {
          return (
            <div className="mt-6 w-full max-w-xl">
              <BlogEntry post={webinar}></BlogEntry>
            </div>
          );
        })}
      <div className="mb-8 mt-20 border-b-2 border-slate-300 pb-3 text-sm dark:border-slate-700">
        <h2 className="font-semibold">Past Webinars</h2>
      </div>
      <div>
        {webinars
          .filter((w) => w.status !== 'Upcoming')
          .map((post, index) => (
            <WebinarListItem
              key={post.slug}
              webinar={post}
              episode={index + 1}
            />
          ))}
      </div>
    </div>
  );
}

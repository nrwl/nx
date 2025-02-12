import { WebinarDataEntry } from '@nx/nx-dev/data-access-documents/node-only';
import { BlogEntry } from '@nx/nx-dev/ui-blog';
import { WebinarListItem } from './webinar-list-item';
import { CallToAction } from '@nx/nx-dev/ui-markdoc';

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
          const authorsList = (
            webinar.authors.length > 1
              ? webinar.authors.map((a, i) =>
                  i === webinar.authors.length - 1 ? 'and ' + a.name : a.name
                )
              : webinar.authors.map((a) => a.name)
          ).join(', ');
          const dateAndTime =
            new Date(webinar.date).toLocaleDateString('en-US', {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            }) + (webinar.time ? ' - ' + webinar.time : '');

          return (
            <div className="mt-6 w-full max-w-xl">
              <BlogEntry
                post={webinar}
                overrideLink={webinar.registrationUrl}
              ></BlogEntry>
              <p className="my-4 font-bold">{dateAndTime}</p>
              <p className="my-4">Presented by {authorsList}</p>
              <p className="my-4">{webinar.description}</p>
              {webinar.registrationUrl && (
                <div className="max-w-md">
                  <CallToAction
                    title="Register today!"
                    description="Save your spot"
                    url={webinar.registrationUrl}
                  ></CallToAction>
                </div>
              )}
            </div>
          );
        })}
      <div className="mt-20 border-b-2 border-slate-300 pb-3 text-lg dark:border-slate-700">
        <h2 className="font-semibold">Past Webinars</h2>
      </div>
      <div>
        {webinars
          .filter((w) => w.status !== 'Upcoming')
          .map((w, index) => (
            <WebinarListItem key={w.slug} webinar={w} episode={index + 1} />
          ))}
      </div>
    </div>
  );
}

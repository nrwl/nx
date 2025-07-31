import { WebinarDataEntry } from '@nx/nx-dev-data-access-documents/node-only';
import { CallToAction } from '@nx/nx-dev-ui-markdoc';
import Image from 'next/image';
import Link from 'next/link';
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
        .filter(
          (w) => w.status === 'Upcoming' && new Date(w.eventDate) >= new Date()
        )
        .map((webinar, index) => {
          const authorsList = (
            webinar.authors.length > 1
              ? webinar.authors.map((a, i) =>
                  i === webinar.authors.length - 1 ? 'and ' + a.name : a.name
                )
              : webinar.authors.map((a) => a.name)
          ).join(', ');
          const dateAndTime =
            new Date(webinar.eventDate).toLocaleDateString('en-US', {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            }) + (webinar.time ? ' - ' + webinar.time : '');

          return (
            <div className="mx-auto mt-8 w-full max-w-4xl lg:flex lg:max-w-7xl lg:gap-4">
              <div className="flex-1">
                <Link
                  href={webinar.registrationUrl || `/blog/${webinar.slug}`}
                  title={webinar.title}
                  className="text-balance text-2xl font-semibold text-slate-900 dark:text-white"
                  prefetch={false}
                >
                  {webinar.title}
                </Link>
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
              <div className="relative hidden h-full flex-1 transform-gpu flex-col overflow-hidden rounded-2xl border border-slate-200 shadow transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-lg lg:flex dark:border-slate-800">
                {webinar.cover_image && (
                  <div className="aspect-[1.7] w-full">
                    <Image
                      quality={100}
                      className="h-full w-full object-cover"
                      src={webinar.cover_image}
                      alt={webinar.title}
                      width={1400}
                      height={735}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      <div className="mt-20 border-b-2 border-slate-300 pb-3 text-lg dark:border-slate-700">
        <h2 className="font-semibold">Past Webinars</h2>
      </div>
      <div>
        {webinars
          .filter(
            (w) => w.status !== 'Upcoming' || new Date(w.eventDate) < new Date()
          )
          .map((w, index) => (
            <WebinarListItem key={w.slug} webinar={w} episode={index + 1} />
          ))}
      </div>
    </div>
  );
}

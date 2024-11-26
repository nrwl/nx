import { SectionHeading } from '@nx/nx-dev/ui-common';
import { Job } from '@nx/nx-dev/data-access-careers/node-only';

interface CurrentOpeningsProps {
  jobs: Job[];
}

export async function CurrentOpenings({ jobs }: CurrentOpeningsProps) {
  return (
    <section
      id="current-openings"
      className="border-b border-t border-slate-100 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-800/60"
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="relative mx-auto max-w-lg divide-y divide-slate-100 lg:max-w-7xl dark:divide-slate-700">
          <header className="max-w-prose">
            <SectionHeading as="h2" variant="title" className="mt-4">
              Current Openings
            </SectionHeading>
          </header>

          <div className="mt-6 grid gap-16 pt-10 lg:grid-cols-2 lg:gap-x-5 lg:gap-y-12">
            {jobs.map((post) => (
              <div
                key={post.title}
                className="relative mt-2 block rounded-lg border border-transparent p-4 transition hover:border-slate-100 hover:shadow-sm dark:hover:border-slate-700"
              >
                <p className="text-lg font-semibold leading-8 tracking-tight text-slate-800 dark:text-slate-200">
                  {post.title}
                </p>
                <p className="mt-3 text-base">
                  {post.location} / {post.team}
                </p>
                <a
                  href={post.url}
                  target="_blank"
                  rel="nofollow noreferrer"
                  className="absolute inset-0"
                  title="Apply for this position"
                >
                  <span className="sr-only">Apply</span>
                </a>
              </div>
            ))}
            {!jobs.length ? (
              <div className="mt-2 block">
                <p className="text-lg font-semibold leading-8 tracking-tight text-slate-800 dark:text-slate-200">
                  There are no job openings at this time.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

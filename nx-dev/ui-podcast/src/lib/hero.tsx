import { SectionHeading } from '@nx/nx-dev/ui-common';
import { ListenOn } from './listen-on';

export function Hero(): JSX.Element {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="grid grid-cols-4 gap-x-4 px-8 lg:grid-cols-12 lg:gap-x-6">
        <div className="col-span-full md:col-span-4 lg:col-span-6">
          <SectionHeading as="h1" variant="title">
            The Enterprise Software Podcast
          </SectionHeading>
          <div className="flex flex-col gap-6">
            <SectionHeading as="p" variant="subtitle" className="mt-8">
              Listen in to some exciting conversations with the hidden
              architects of enterprise software.
            </SectionHeading>
            <div className="flex flex-col gap-3 text-lg">
              <p className="font-medium text-slate-950 dark:text-white">
                Available On:{' '}
              </p>
              <ListenOn />
            </div>
          </div>
        </div>
        <div className="hidden lg:col-span-3 lg:col-start-10 lg:block">
          <img
            className="aspect[1/1] rounded-lg border-8 border-slate-800/50 object-cover dark:border-white"
            src="/images/podcast/podcast-hero.avif"
            alt="Illustration of a microphone"
          />
        </div>
      </div>
    </div>
  );
}

import { SectionHeading } from '@nx/nx-dev/ui-common';

export function Hero(): JSX.Element {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="grid grid-cols-4 gap-x-4 px-8 lg:grid-cols-12 lg:gap-x-6">
        <div className="col-span-full md:col-span-4 lg:col-span-6">
          <SectionHeading as="h1" variant="title">
            Nx Webinars
          </SectionHeading>
          <div className="flex flex-col gap-6">
            <SectionHeading as="p" variant="subtitle" className="mt-8">
              In-depth explanations and interactive Q&A sessions with Nx team
              members
            </SectionHeading>
          </div>
        </div>
      </div>
    </div>
  );
}

import { ReactElement } from 'react';
import { VmwareIcon } from '@nx/nx-dev/ui-icons';
import { ButtonLink, SectionHeading } from '@nx/nx-dev/ui-common';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

export function VmwareTestimonial(): ReactElement {
  return (
    <div className="">
      <div className="mx-auto max-w-7xl rounded-lg bg-black px-4 py-12 sm:px-6 lg:px-8 lg:py-24">
        <blockquote className="mx-auto max-w-4xl">
          <VmwareIcon aria-hidden="true" className="size-20 text-white" />

          <p className="text-xl text-white sm:text-2xl md:text-3xl md:leading-normal">
            Since using Nx Cloud, we saw our CI times reduced by 83%! That means
            our teams are not waiting hours for their PR to be merged anymore,
            we reclaimed our productivity and are pretty happy about it.
          </p>

          <p className="mt-4 text-right md:text-lg">
            <span className="font-semibold text-sky-500">
              Laurent Delamare,
            </span>{' '}
            <span className="text-neutral-500">Senior Engineer</span>
          </p>
          <footer className="mt-6 md:mt-10">
            <div className="flex items-center justify-center gap-8">
              <SectionHeading as="p" variant="subtitle" className="text-white">
                Curious how they did it?
              </SectionHeading>
              <ButtonLink
                href="https://go.nx.dev/ci-ebook"
                title="Download the guide"
                variant="secondary"
                size="small"
              >
                <ArrowDownTrayIcon
                  aria-hidden="true"
                  className="size-5 shrink-0"
                />
                <span>Download the guide</span>
              </ButtonLink>
            </div>
          </footer>
        </blockquote>
      </div>
    </div>
  );
}

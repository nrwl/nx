import { ReactElement } from 'react';
import { ButtonLink, SectionHeading } from '@nx/nx-dev/ui-common';
import Image from 'next/image';

export function GetStarted(): ReactElement {
  return (
    <section id="get-started" className="scroll-mt-24">
      <div className="mx-auto max-w-7xl py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="relative isolate overflow-hidden bg-blue-500 px-6 shadow-2xl sm:rounded-3xl sm:px-16 lg:flex lg:gap-x-20 lg:px-24 lg:pt-0 dark:bg-white">
          <div className="mx-auto max-w-md text-center lg:mx-0 lg:flex-auto lg:py-32 lg:text-left">
            <SectionHeading
              as="h2"
              variant="title"
              id="get-started-title"
              className="text-white dark:text-slate-950"
            >
              Get Started
            </SectionHeading>
            <SectionHeading
              as="p"
              variant="subtitle"
              className="mt-8 text-white dark:text-slate-950"
            >
              In 5 minutes, you'll see the difference.
            </SectionHeading>
            <div className="mt-10 flex items-center justify-center gap-x-6 lg:justify-start">
              <ButtonLink
                href="https://cloud.nx.app/get-started"
                title="Get Started With Nx Cloud"
                variant="secondary"
                size="large"
              >
                Get started now
              </ButtonLink>
            </div>
          </div>
          <div className="relative mt-16 h-80 lg:mt-8">
            <Image
              src="/images/cloud/nrwl-ocean.avif"
              alt="App screenshot: overview"
              width={960}
              height={620}
              loading="eager"
              priority
              className="w-228 absolute left-0 top-0 max-w-none rounded-md bg-white/5 ring-1 ring-white/10 dark:bg-black/5 dark:ring-black/10"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

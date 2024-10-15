import { SectionHeading } from '@nx/nx-dev/ui-common';
import type { ReactElement } from 'react';

export function OssCallout(): ReactElement {
  return (
    <section id="oss-callout">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading as="h2" variant="title">
            Free for OSS
          </SectionHeading>
          <SectionHeading as="p" variant="subtitle" className="text mt-6">
            Our pledge and support to open source software,
            <br /> build amazing things for the community.
          </SectionHeading>
        </div>

        <div className="relative mx-auto mt-12 max-w-2xl space-y-12">
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <a
              href="https://google.com"
              target="_blank"
              title="Enroll to the Nx Powerpack OSS program"
              className="rounded-md bg-slate-950 px-3.5 py-2.5 text-sm font-semibold text-slate-100 shadow-sm hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              Apply to the Nx Powerpack OSS program
            </a>
          </div>
          <div>
            <p className="text-center text-xs">
              The Nx Powerpack OSS program is specifically designed to support
              open-source projects. Participation in the program is subject to
              specific conditions and limitations, which may vary on a
              case-by-case basis.
            </p>
            <p className="mt-2 text-center text-xs">
              Application approval is not guaranteed and is at the sole
              discretion of the program administrators. Nx reserves the right to
              modify or discontinue the program at any time without prior
              notice. Participation in this program does not imply endorsement
              or partnership with Nx or its affiliates.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

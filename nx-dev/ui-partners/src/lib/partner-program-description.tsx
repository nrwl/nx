import { SectionDescription, SectionHeading } from '@nx/nx-dev/ui-common';
import { type ReactElement } from 'react';

export function PartnerProgramDescription(): ReactElement {
  return (
    <section id="partners">
      <div className="mt-8 px-6">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <SectionHeading
              as="h2"
              variant="subtitle"
              id="trusted"
              className="scroll-mt-24 font-medium tracking-tight text-slate-950 sm:text-3xl dark:text-white"
            >
              Why Partners Matter
            </SectionHeading>
          </div>
          <SectionDescription as="p" className="my-6">
            Our partners help empower the Nx ecosystem. They:
          </SectionDescription>
          <div className="mb-2 border-l-2 border-blue-900/70 pl-4 font-bold text-slate-700 sm:text-2xl dark:border-sky-300/60 dark:text-slate-200">
            Offer Services
          </div>
          <div className="mb-6 text-balance pl-[18px] text-lg text-slate-500 dark:text-slate-400">
            Offering expert consulting, training, and implementation services.
          </div>
          <div className="mb-2 border-l-2 border-blue-900/70 pl-4 font-bold text-slate-700 sm:text-2xl dark:border-sky-300/60 dark:text-slate-200">
            Build Tools
          </div>
          <div className="mb-6 text-balance pl-[18px] text-lg text-slate-500 dark:text-slate-400">
            Building tools and integrations to help your organization and the
            overall Nx ecosystem.
          </div>
          <div className="mb-2 border-l-2 border-blue-900/70 pl-4 font-bold text-slate-700 sm:text-2xl dark:border-sky-300/60 dark:text-slate-200">
            Create Content
          </div>
          <div className="mb-6 text-balance pl-[18px] text-lg text-slate-500 dark:text-slate-400">
            Contributing valuable content, resources, and community engagement.
          </div>
        </div>
      </div>
    </section>
  );
}

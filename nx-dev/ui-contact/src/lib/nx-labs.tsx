import {
  SectionHeading,
  HubspotForm,
  Strong,
  SectionDescription,
} from '@nx/nx-dev-ui-common';
import { type ReactElement } from 'react';
import {
  BillIcon,
  CapitalOneIcon,
  CaterpillarIcon,
  ManIcon,
  RedwoodJsIcon,
  RoyalBankOfCanadaIcon,
  ShopifyIcon,
  SiriusxmAlternateIcon,
  StorybookIcon,
  VmwareIcon,
  ZipariIcon,
} from '@nx/nx-dev-ui-icons';

export function NxLabsContact(): ReactElement {
  return (
    <section id="contact-sales">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading as="h1" variant="display" id="how-can-we-help">
            Accelerate Your Nx Adoption with Expert Guidance
          </SectionHeading>
        </div>
        <div className="mx-auto mt-16 flex max-w-5xl flex-col gap-12 md:flex-row lg:gap-8">
          <section className="mt-4 flex-1">
            <SectionHeading
              as="p"
              variant="subtitle"
              className="mx-auto mt-6 max-w-3xl lg:pr-20"
            >
              Nx Labs: Service built for outcomes
            </SectionHeading>
            <SectionDescription as="p" className="mt-6">
              Whether you're just getting started with Nx or looking to unlock
              its full potential, our{' '}
              <Strong>
                team of experts delivers tailored solutions that actually work
              </Strong>
              . From initial setup to advanced optimization, we offer workspace
              assessments, hands-on team training, embedded engineering support,
              and on-demand expertise—all designed to make your team
              self-sufficient.
            </SectionDescription>
            <SectionDescription as="p" className="mt-4">
              Unlike traditional consultants, we believe in planned
              obsolescence–nothing makes us prouder than seeing more Nx experts
              out in the wild.
            </SectionDescription>
            <SectionDescription as="p" className="mt-4">
              Ready to see what a truly optimized workspace looks like? Reach
              out and let us know what you need.
            </SectionDescription>

            <figure className="mt-12 border-l border-slate-200 pl-8 dark:border-slate-800">
              <blockquote className="text-base/7">
                <p>
                  “Nx’s professional services team was instrumental in helping
                  us modernize our development workflow. The team is extremely
                  personable and knowledgeable. It is a pleasure to work with
                  them to get the most out of our investment.”
                </p>
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-x-4 text-sm/6">
                <img
                  alt="Wayne Kaskie"
                  src="https://avatars.githubusercontent.com/u/14349014?v=4"
                  className="size-8 flex-none rounded-full"
                />
                <div>
                  <div className="font-semibold">Wayne Kaskie</div>
                  <div className="text-slate-500">
                    Front End Architect, Zipari
                  </div>
                </div>
                <ZipariIcon
                  aria-hidden="true"
                  className="ml-auto size-10 text-[#E31E39]"
                />
              </figcaption>
            </figure>
            <div className="mx-auto mt-12 grid w-full grid-cols-4 gap-2 md:grid-cols-4 lg:mt-12">
              <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
                <RoyalBankOfCanadaIcon
                  aria-hidden="true"
                  className="size-12 text-black dark:text-white"
                />
              </div>
              <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
                <VmwareIcon
                  aria-hidden="true"
                  className="size-28 text-black dark:text-white"
                />
              </div>
              <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
                <BillIcon
                  aria-hidden="true"
                  className="size-14 text-black dark:text-white"
                />
              </div>
              <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
                <CapitalOneIcon
                  aria-hidden="true"
                  className="size-28 text-black dark:text-white"
                />
              </div>
            </div>
          </section>
          <section className="flex-1 self-start rounded-xl border border-slate-200 bg-white p-8 dark:border-slate-800/40">
            <HubspotForm
              region="na1"
              portalId="2757427"
              formId="d5710d48-85de-4b17-ab97-4c22c25a8f02"
              noScript={true}
              loading={<div>Loading...</div>}
            />
          </section>
        </div>
      </div>
    </section>
  );
}

import { SectionHeading, HubspotForm } from '@nx/nx-dev/ui-common';
import { type ReactElement } from 'react';
import {
  CapitalOneIcon,
  CaterpillarIcon,
  ManIcon,
  RedwoodJsIcon,
  RoyalBankOfCanadaIcon,
  ShopifyIcon,
  SiriusxmAlternateIcon,
  StorybookIcon,
  VmwareIcon,
} from '@nx/nx-dev/ui-icons';

export function TalkToOurEngineeringTeam(): ReactElement {
  return (
    <section id="contact-sales">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading as="h1" variant="display" id="how-can-we-help">
            Talk to our engineering team
          </SectionHeading>
        </div>
        <div className="mx-auto mt-16 flex max-w-5xl flex-col gap-12 md:flex-row lg:gap-8">
          <section className="mt-4 flex-1">
            <p className="text-lg leading-relaxed">
              Contact our Developer Productivity Engineers for demos,
              onboarding, and product questions. Share your requirements and
              challenges with us, and{' '}
              <span className="font-medium">
                we will help you utilize Nx Enterprise to enhance your
                organization's product development
              </span>
              .
            </p>
            <p className="mt-4 text-lg leading-relaxed">
              Fill out the form, and we’ll get back to you to schedule a call or
              start the discussion on a shared Slack.
            </p>

            <figure className="mt-12 border-l border-slate-200 pl-8 dark:border-slate-800">
              <blockquote className="text-base/7">
                <p>
                  “The decision to jump to Nx Cloud was really something we
                  wanted from the beginning. There's nothing but benefits from
                  it. Nx means tooling and efficiency around our software
                  development lifecycle that empowers us to move a lot faster,
                  ship code faster and more reliably.”
                </p>
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-x-4 text-sm/6">
                <img
                  alt="Justin Schwartzenberger"
                  src="https://avatars.githubusercontent.com/u/1243236?v=4"
                  className="size-8 flex-none rounded-full"
                />
                <div>
                  <div className="font-semibold">Justin Schwartzenberger</div>
                  <div className="text-slate-500">
                    Principal Software Engineer, SiriusXM
                  </div>
                </div>
                <SiriusxmAlternateIcon
                  aria-hidden="true"
                  className="ml-auto size-10 text-[#0000EB]"
                />
              </figcaption>
            </figure>
            <div className="mx-auto mt-12 grid w-full grid-cols-4 gap-2 md:grid-cols-2 lg:mt-12">
              <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
                <RoyalBankOfCanadaIcon
                  aria-hidden="true"
                  className="size-14 text-black dark:text-white"
                />
              </div>

              <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
                <ManIcon
                  aria-hidden="true"
                  className="size-14 text-[#E40045]"
                />
              </div>
              <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
                <ShopifyIcon
                  aria-hidden="true"
                  className="size-12 text-[#7AB55C]"
                />
              </div>
              <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
                <CapitalOneIcon
                  aria-hidden="true"
                  className="size-28 text-black dark:text-white"
                />
              </div>
              <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
                <VmwareIcon
                  aria-hidden="true"
                  className="size-28 text-black dark:text-white"
                />
              </div>
              <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
                <StorybookIcon
                  aria-hidden="true"
                  className="size-12 text-[#FF4785]"
                />
              </div>
              <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
                <RedwoodJsIcon
                  aria-hidden="true"
                  className="size-12 text-[#BF4722]"
                />
              </div>
              <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
                <CaterpillarIcon
                  aria-hidden="true"
                  className="size-14 text-[#FFCD11]"
                />
              </div>
            </div>
          </section>
          <section className="flex-1 self-start rounded-xl border border-slate-200 bg-white p-8 dark:border-slate-800/40">
            <HubspotForm
              region="na1"
              portalId="2757427"
              formId="c88140bc-0b93-4238-b838-77dd4047bb32"
              noScript={true}
              loading={<div>Loading...</div>}
            />
          </section>
        </div>
      </div>
    </section>
  );
}

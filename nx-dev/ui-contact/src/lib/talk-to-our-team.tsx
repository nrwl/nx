import { SectionHeading, HubspotForm } from '@nx/nx-dev-ui-common';
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
} from '@nx/nx-dev-ui-icons';

export function TalkToOurTeam(): ReactElement {
  return (
    <section id="contact-team">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading as="h1" variant="display" id="how-can-we-help">
            Talk to our team
          </SectionHeading>
        </div>
        <div className="mx-auto mt-16 flex max-w-5xl flex-col gap-12 md:flex-row lg:gap-8">
          <section className="flex-1">
            <p className="text-lg leading-relaxed">
              Whether you’re scaling your team, optimizing CI pipelines, or
              exploring the full potential of Nx, we’re here to help. Reach out
              to:
            </p>
            <div className="mt-4">
              <ul className="ml-4 list-inside list-disc space-y-2">
                <li> Learn about our products and solutions. </li>
                <li> Demo our products firsthand and see the difference. </li>
                <li> Find the right plan for your unique needs. </li>
              </ul>
            </div>
            <p className="mt-5 text-lg font-bold leading-relaxed">
              Let’s Talk!
            </p>
            <p className="text-lg leading-relaxed">
              Fill out the form, an Nx expert with reach out shortly.
            </p>

            <figure className="mt-12 rounded-lg bg-slate-100 p-4 pl-8 dark:bg-slate-800">
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
                  className="ml-auto size-10 rounded text-[#0000EB] dark:bg-slate-200"
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
          <section className="w-full flex-1 rounded-xl border border-slate-200 bg-white p-8 md:self-start dark:border-slate-800/40">
            <HubspotForm
              region="na1"
              portalId="2757427"
              formId="2e492124-843c-4a6d-87fe-93db27ab4323"
              noScript={true}
              loading={<div>Loading...</div>}
            />
          </section>
        </div>
      </div>
    </section>
  );
}

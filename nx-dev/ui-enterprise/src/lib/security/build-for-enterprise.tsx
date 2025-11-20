'use client';
import { SectionHeading } from '@nx/nx-dev-ui-common';
import { ReactElement } from 'react';
import {
  AdobeIcon,
  AwsIcon,
  CapitalOneIcon,
  FicoIcon,
  ModernaIcon,
  PayfitIcon,
  RoyalBankOfCanadaIcon,
} from '@nx/nx-dev-ui-icons';

export function BuiltForEnterprise(): ReactElement {
  return (
    <section
      id="built-for-enteprise-section"
      className="scroll-mt-24 overflow-hidden"
    >
      <div className="mx-auto max-w-7xl lg:px-8">
        <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:gap-y-20 lg:grid-cols-3 lg:items-start">
          <div className="mt-4 flex flex-col justify-items-stretch gap-4 sm:px-6 lg:px-0">
            <div className="mt-12 grid w-full grid-cols-2 place-items-center gap-6">
              <CapitalOneIcon
                aria-hidden="true"
                className="col-span-1 size-28  text-black dark:text-white"
              />

              <FicoIcon
                aria-hidden="true"
                className="col-span-1 size-24  text-[#0A6DE6] dark:text-white"
              />

              <AwsIcon
                aria-hidden="true"
                className="col-span-1 size-14 text-[#FF9900] dark:text-white"
              />

              <ModernaIcon
                aria-hidden="true"
                className="col-span-1 size-24  text-black dark:text-white"
              />

              <RoyalBankOfCanadaIcon
                aria-hidden="true"
                className="col-span-1 size-14  text-black dark:text-white"
              />

              <AdobeIcon
                aria-hidden="true"
                className="col-span-1 size-14  text-[#FF0000] dark:text-white"
              />
            </div>
          </div>
          <div className="col-span-2 px-6 md:px-0 lg:pr-4 lg:pt-4">
            <SectionHeading as="h2" variant="title" id="built-for-enteprise">
              Built for the Enterprise, Trusted by Leading Teams
            </SectionHeading>
            <SectionHeading as="p" variant="subtitle" className="mt-6">
              Thousands of developers rely on Nx Cloud to move fast — and stay
              secure.
            </SectionHeading>

            <figure className="mt-16 rounded-lg bg-slate-100 p-4 pl-8 dark:bg-slate-800">
              <blockquote className="text-base/7">
                <p>
                  “Nx is the tool that helps gain speed and trust on the overall
                  system and empowers engineers and product builders to ship
                  faster → to go to market faster.”
                </p>
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-x-4 text-sm/6">
                <img
                  alt="avatar"
                  src="https://avatars.githubusercontent.com/u/7281023?v=4"
                  className="size-8 flex-none rounded-full"
                />
                <div>
                  <div className="font-semibold">Nicolas Beaussart</div>
                  <div className="text-slate-500">
                    Staff Platform Engineer, Payfit
                  </div>
                </div>
                <PayfitIcon
                  aria-hidden="true"
                  className="ml-auto size-10 rounded text-[#0F6FDE] dark:text-white"
                />
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}

import { HubspotForm, SectionHeading } from '@nx/nx-dev-ui-common';
import { type ReactElement } from 'react';
import {
  CapitalOneIcon,
  CasewareIcon,
  CaterpillarIcon,
  RoyalBankOfCanadaIcon,
  ShopifyIcon,
} from '@nx/nx-dev-ui-icons';
import { ArrowLongRightIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export function TrialNxPowerpack(): ReactElement {
  return (
    <section id="trial-nx-powerpack">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-6xl text-center">
          <SectionHeading as="h1" variant="display" id="try-nx-powerpack">
            Try Nx Powerpack
            <br />
            for free
          </SectionHeading>
        </div>
        <div className="mx-auto mt-16 flex max-w-5xl flex-col gap-12 md:flex-row lg:gap-8">
          <section className="flex-1">
            <h3 className="text-3xl font-semibold text-slate-950 dark:text-white">
              {' '}
              Did you know Powerpack is included in Nx Enterprise?{' '}
            </h3>
            <p className="mt-8 text-lg leading-relaxed">
              Nx Enterprise is how the best companies in the world solve the
              performance paradox, obtaining speed and scale.
            </p>

            <div className="py-12">
              <Link
                prefetch={false}
                className="group text-lg font-semibold italic leading-relaxed underline"
                href="/enterprise/trial"
              >
                Request a trial of Nx Enterprise{' '}
                <ArrowLongRightIcon
                  className="inline-block h-6 w-6 transition group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            </div>

            <figure className="rounded-lg bg-slate-100 p-4 pl-8 dark:bg-slate-800">
              <blockquote className="text-base/7">
                <p>
                  “They asked me a few years ago, ‘Do you want to trial Nx
                  Enterprise?’ and I said, ‘Sure, why not?’ it was actually
                  pretty easy, and immediately the feedback was, ‘Wow, this is a
                  huge time saver!’ Once it expired, it was an immediate, “Oh
                  no, what are we going to do?”
                </p>
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-x-4 text-sm/6">
                <img
                  alt="Amir Toole"
                  src="/images/customers/enterprise/amir-toole-caseware-headshot.avif"
                  className="size-8 flex-none rounded-full"
                />
                <div>
                  <div className="font-semibold">Amir Toole</div>
                  <div className="text-slate-500">
                    VP of Engineering, Caseware
                  </div>
                </div>
                <CasewareIcon
                  aria-hidden="true"
                  className="ml-auto size-10 text-[#F56354]"
                />
              </figcaption>
            </figure>
            <div className="mt-12 grid w-full grid-cols-4 place-items-center gap-2">
              <CapitalOneIcon
                aria-hidden="true"
                className="col-span-1 size-28  text-black dark:text-white"
              />

              <CaterpillarIcon
                aria-hidden="true"
                className="col-span-1 size-14  text-[#FFCD11]"
              />

              <RoyalBankOfCanadaIcon
                aria-hidden="true"
                className="col-span-1 size-14  text-black dark:text-white"
              />

              <ShopifyIcon
                aria-hidden="true"
                className="col-span-1 size-14 text-[#7AB55C]"
              />
            </div>
          </section>
          <section className="flex-1 rounded-xl border border-slate-200 bg-white p-8 md:self-start dark:border-slate-800/40">
            <HubspotForm
              region="na1"
              portalId="2757427"
              formId="51f57ff4-d42d-4d10-b3b6-901f8ec2c530"
              noScript={true}
              loading={<div>Loading...</div>}
            />
          </section>
        </div>
      </div>
    </section>
  );
}

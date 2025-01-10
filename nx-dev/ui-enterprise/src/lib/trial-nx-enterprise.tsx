import { SectionHeading, HubspotForm } from '@nx/nx-dev/ui-common';
import { type ReactElement } from 'react';
import {
  CapitalOneIcon,
  CasewareIcon,
  CaterpillarIcon,
  RoyalBankOfCanadaIcon,
  ShopifyIcon,
} from '@nx/nx-dev/ui-icons';
import { ArrowLongRightIcon } from '@heroicons/react/24/outline';

export function TrialNxEnterprise(): ReactElement {
  return (
    <section id="enterprise-trial">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading as="h1" variant="display" id="trial-nx-enterprise">
            Discover Your <br />
            Nx Enterprise ROI
          </SectionHeading>
        </div>
        <div className="mx-auto mt-16 flex max-w-5xl flex-col gap-12 md:flex-row lg:gap-8">
          <section className="flex-1">
            <h3 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              {' '}
              Much more than a simple trial{' '}
            </h3>

            <p className="mt-8 text-lg leading-relaxed">
              An Nx Enterprise <span className="font-bold">Proof of Value</span>{' '}
              is your hands-on opportunity to boost CI & DX, realize Nx’s full
              value, and quantify your ROI. Let us guide you.
            </p>
            <div className="py-12">
              <a
                target="_blank"
                className="group text-lg font-semibold italic leading-relaxed underline"
                href="/assets/enterprise/Nx-Enterprise-POV.pdf"
              >
                How a Proof of Value works{' '}
                <ArrowLongRightIcon
                  className="inline-block h-6 w-6 transition group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </a>
            </div>
            <figure className="rounded-lg bg-slate-100 p-4 pl-8 dark:bg-slate-800">
              <blockquote className="text-base/7">
                <p>
                  “They asked me a few years ago, ‘Do you want to trial Nx
                  Enterprise?’ and I said, ‘Sure, why not?’ It was actually
                  pretty easy, and immediately the feedback was, ‘Wow, this is a
                  huge time saver!’ Once it expired, it was an immediate, ‘Oh
                  no, what are we going to do?’”
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
              formId="e7f05c82-b56c-4a31-8cf8-a53ca8d69c5b"
              noScript={true}
              loading={<div>Loading...</div>}
            />
          </section>
        </div>
      </div>
    </section>
  );
}

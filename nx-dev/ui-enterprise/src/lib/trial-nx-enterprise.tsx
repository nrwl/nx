import { SectionHeading, HubspotForm } from '@nx/nx-dev/ui-common';
import { ReactElement } from 'react';
import {
  CapitalOneIcon,
  CasewareIcon,
  CaterpillarIcon,
  ManIcon,
  RedwoodJsIcon,
  RoyalBankOfCanadaIcon,
  ShopifyIcon,
  StorybookIcon,
  VmwareIcon,
} from '@nx/nx-dev/ui-icons';

export function TrialNxEnterprise(): ReactElement {
  return (
    <section id="enterprise-trial">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading as="h1" variant="display" id="trial-nx-enterprise">
            Start a Trial of Nx Enterprise
          </SectionHeading>
        </div>
        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-12 md:grid-cols-2 lg:gap-8">
          <section className="mt-4">
            <p className="text-lg leading-relaxed">
              Unlock the full potential of Nx Enterprise with a hands-on guided
              trial. Experience how our tools and expert support can transform
              your workflows, improve CI performance, and boost developer
              productivity.
            </p>
            <p className="mt-4 text-lg font-bold leading-relaxed">
              What to Expect
            </p>
            <div className="mt-4">
              <ul className="ml-4 list-inside list-disc space-y-2">
                <li>
                  Expert guidance: Work directly with Nx engineers to set up and
                  optimize your workspace.{' '}
                </li>
                <li>
                  Measurable improvements: Gain real-world insights into faster
                  builds, more reliable pipelines, and enhanced developer
                  productivity.{' '}
                </li>
                <li>
                  Tailored solutions: Address your team’s unique challenges with
                  targeted optimizations.{' '}
                </li>
                <li>
                  Proof of value: Receive support in presenting measurable
                  results and a compelling business case to your internal
                  stakeholders.{' '}
                </li>
              </ul>
            </div>
            <p className="mt-5 text-lg leading-relaxed">
              This trial is designed to help you evaluate Nx Enterprise with
              confidence - seeing firsthand how it fits into your workflows and
              delivers measurable value.
            </p>

            <p className="mt-5 text-lg font-bold leading-relaxed">
              Want to learn more about the guided trial?
            </p>
            <p className="mt-2 leading-relaxed">
              The <span className="font-bold">Proof of Value PDF</span> below
              provides a detailed overview of what you can expect when
              partnering with Nx.
            </p>
            <div className="py-10">
              <a
                target="_blank"
                className="mt-4 text-lg font-bold leading-relaxed hover:underline"
                href="/assets/enterprise/Nx-Enterprise-POV.pdf"
              >
                View PDF
              </a>
            </div>
            <p className="text-lg font-bold leading-relaxed">Ready to Start?</p>
            <p className="text-lg leading-relaxed">
              Fill out the form to request a free trial of Nx Enterprise.
            </p>
            <figure className="mt-12 rounded-lg bg-slate-100 p-4 pl-8 dark:bg-slate-800">
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
          <section className="rounded-xl border border-slate-200 bg-white p-8 dark:border-slate-800/40">
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

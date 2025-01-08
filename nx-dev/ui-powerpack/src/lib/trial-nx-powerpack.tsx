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

export function TrialNxPowerpack(): ReactElement {
  return (
    <section id="trial-nx-powerpack">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-6xl text-center">
          <SectionHeading as="h1" variant="display" id="try-nx-powerpack">
            Start a Trial of <br />
            Nx Powerpack
          </SectionHeading>
        </div>
        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-12 md:grid-cols-2 lg:gap-8">
          <section className="mt-4">
            <p className="text-lg leading-relaxed">
              Experience faster, more secure caching for your monorepo. Nx
              Powerpack helps you streamline builds and testing, enabling your
              team to deliver with confidence at scale.
            </p>
            <div className="mt-4">
              <ol className="ml-4 list-inside list-decimal space-y-2">
                <li>
                  {' '}
                  <span className="font-bold">Self-hosted cache storage</span>
                  <p className="ml-4 mt-2">
                    Utilize Amazon S3 or a shared network drive as your remote
                    cache storage, offering a flexible, self-managed solution
                    for faster builds.
                  </p>{' '}
                </li>
                <li>
                  <span className="font-bold">Workspace Conformance</span>
                  <p className="ml-4 mt-2">
                    Establish and enforce conformance rules across your
                    workspace to maintain alignment with organizational
                    standards.
                  </p>
                </li>
                <li>
                  <span className="font-bold">Code Owners for Monorepos</span>
                  <p className="ml-4 mt-2">
                    Streamline collaboration with clearly defined code ownership
                    at the project level. Ensure that the right teams review the
                    right changes, reducing bottlenecks and improving code
                    quality across large teams.
                  </p>
                </li>
              </ol>
            </div>
            <p className="mt-8 text-lg font-bold leading-relaxed">
              Want to give it a try?
            </p>
            <p className="text-lg leading-relaxed">
              Fill out the form to request a trial of Nx Powerpack.
            </p>

            <p className="mt-12 text-lg font-bold leading-relaxed">
              Looking for a bit more?
            </p>
            <p className="text-lg leading-relaxed">
              Nx Powerpack is included for all Nx Enterprise customers, request
              a free trial of Nx Enterprise{' '}
              <a
                className="text-blue-500 hover:underline"
                href="/enterprise/trial"
              >
                here
              </a>
              .
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

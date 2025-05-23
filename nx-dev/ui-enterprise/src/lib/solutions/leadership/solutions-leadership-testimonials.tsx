import type { ReactElement } from 'react';
import {
  CasewareIcon,
  HetznerCloudIcon,
  PayfitIcon,
  SiriusxmAlternateIcon,
} from '@nx/nx-dev/ui-icons';
import { SectionHeading } from '@nx/nx-dev/ui-common';

export function SolutionsLeadershipTestimonials(): ReactElement {
  return (
    <div className="border border-slate-100 bg-slate-50 px-6 py-24 sm:px-6 sm:py-32 lg:px-8 dark:border-slate-900 dark:bg-slate-900/[0.8]">
      <div className="mx-auto max-w-5xl text-center">
        <SectionHeading as="h2" variant="title" id="testimonials">
          Don't just take our word for it.
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Don't just take our word for it. See how Nx transforms development for
          teams worldwide.
        </SectionHeading>
      </div>
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-3">
        <figure className="mt-16 flex flex-col justify-between rounded-lg bg-white p-4 pl-8 dark:bg-slate-950">
          <blockquote className="text-base/7">
            <p>
              "The hours we spent manually load balancing in CircleCI was
              painful. With Nx Cloud we offload that complexity and that keeps
              velocity at scale in a large monorepo."
            </p>
          </blockquote>
          <figcaption className="mt-6 flex items-center gap-x-4 text-sm/6">
            <img
              alt="Nicolas Beaussart, Staff Platform Engineer, Payfit"
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
              className="ml-auto size-10 shrink-0 text-[#0F6FDE]"
            />
          </figcaption>
        </figure>
        <figure className="mt-16 flex flex-col justify-between rounded-lg bg-white p-4 pl-8 dark:bg-slate-950">
          <blockquote className="text-base/7">
            <p>
              “Nx means tooling and efficiency around our software development
              lifecycle that empowers us to move a lot faster, ship code faster
              and more reliably.”
            </p>
          </blockquote>
          <figcaption className="mt-6 flex items-center gap-x-4 text-sm/6">
            <img
              alt="Justin Schwartzenberger, Principal Software Engineer, SiriusXM"
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
              className="ml-auto size-10 shrink-0 rounded text-[#0000EB] dark:bg-slate-200"
            />
          </figcaption>
        </figure>

        <figure className="mt-16 flex flex-col justify-between rounded-lg bg-white p-4 pl-8 dark:bg-slate-950">
          <blockquote className="text-base/7">
            <p>
              "We leverage Nx to share code, UX, and styles. All teams decided
              to migrate their frontend code to it. We then moved a backend app
              in, and devs loved it so now every app’s there."
            </p>
          </blockquote>
          <figcaption className="mt-6 flex items-center gap-x-4 text-sm/6">
            <img
              alt="Amir Toole, VP of Engineering, Caseware"
              src="/images/customers/enterprise/amir-toole-caseware-headshot.avif"
              className="size-8 flex-none rounded-full"
            />
            <div>
              <div className="font-semibold">Amir Toole</div>
              <div className="text-slate-500">VP of Engineering, Caseware</div>
            </div>
            <CasewareIcon
              aria-hidden="true"
              className="ml-auto size-10 text-[#F56354]"
            />
          </figcaption>
        </figure>
      </div>
    </div>
  );
}

import type { ReactElement } from 'react';
import {
  CasewareIcon,
  PayfitIcon,
  SiriusxmAlternateIcon,
  UkgIcon,
} from '@nx/nx-dev/ui-icons';
import { SectionHeading } from '@nx/nx-dev/ui-common';

export function SolutionsPlatformTestimonials(): ReactElement {
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
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-3">
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
              className="ml-auto size-10 rounded text-[#0000EB] dark:bg-slate-200"
            />
          </figcaption>
        </figure>
        <figure className="mt-16 flex flex-col justify-between rounded-lg bg-white p-4 pl-8 dark:bg-slate-950">
          <blockquote className="text-base/7">
            <p>
              "A year ago, to deploy a feature, it took 2-5 days. Now the same
              feature takes 2 hours. We use Nx Cloud to speed up CI. Without it,
              we couldn’t have the velocity that we have right now."
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
              className="ml-auto size-10 text-[#0F6FDE]"
            />
          </figcaption>
        </figure>
        <figure className="mt-16 flex flex-col justify-between rounded-lg bg-white p-4 pl-8 dark:bg-slate-950">
          <blockquote className="text-base/7">
            <p>
              “We got requests from other feature teams saying they wanted to
              build an experience to deploy on mobile and web. With Nx we can
              share libraries so they can build on top of what we’ve already
              built and reduce code duplication.”
            </p>
          </blockquote>
          <figcaption className="mt-6 flex items-center gap-x-4 text-sm/6">
            <img
              alt="Sid Govindaraju, Engineering Manager, UKG"
              src="https://media.licdn.com/dms/image/v2/C4D03AQH0wxtNq8Brhw/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1639897842208?e=2147483647&v=beta&t=wPVxARsxwab6nvYv6DrsP1XnjsUksa2Nmx5kPlp2ny8"
              className="size-8 flex-none rounded-full"
            />
            <div>
              <div className="font-semibold">Sid Govindaraju</div>
              <div className="text-slate-500">Engineering Manager, UKG</div>
            </div>
            <UkgIcon
              aria-hidden="true"
              className="ml-auto size-10 shrink-0 text-[#005151] dark:text-white"
            />
          </figcaption>
        </figure>
      </div>
    </div>
  );
}

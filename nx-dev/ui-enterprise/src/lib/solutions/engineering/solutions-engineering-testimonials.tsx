import type { ReactElement } from 'react';
import {
  CasewareIcon,
  HetznerCloudIcon,
  PayfitIcon,
  SiriusxmAlternateIcon,
  UkgIcon,
  VmwareIcon,
} from '@nx/nx-dev/ui-icons';
import { SectionHeading } from '@nx/nx-dev/ui-common';

export function SolutionsEngineeringTestimonials(): ReactElement {
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
              “Using Nx Cloud, our CI times have reduced by 83%! Our teams are
              not waiting hours for their PR to be merged anymore and we
              reclaimed our productivity.”
            </p>
          </blockquote>
          <figcaption className="mt-6 flex items-center gap-x-4 text-sm/6">
            <img
              alt="Laurent Delamare, Senior Engineer, VMware"
              src="https://avatars.githubusercontent.com/u/11790472?v=4"
              className="size-8 flex-none rounded-full"
            />
            <div>
              <div className="font-semibold">Laurent Delamare</div>
              <div className="text-slate-500">Senior Engineer, VMware</div>
            </div>
            <VmwareIcon
              aria-hidden="true"
              className="mx-auto size-14 flex-none shrink-0  text-white"
            />
          </figcaption>
        </figure>
        <figure className="mt-16 flex flex-col justify-between rounded-lg bg-white p-4 pl-8 dark:bg-slate-950">
          <blockquote className="text-base/7">
            <p>
              "Engineers will run a test command and expect it to run for 20
              mins, when it finishes in a few seconds, they ask “Did I start it
              wrong? Why is it so fast?"
            </p>
          </blockquote>
          <figcaption className="mt-6 flex items-center gap-x-4 text-sm/6">
            <img
              alt="Pavlo Grosse, Senior Software Engineer, Hetzner Cloud"
              src="https://avatars.githubusercontent.com/u/2219064?v=4"
              className="size-8 flex-none rounded-full"
            />
            <div>
              <div className="font-semibold">Pavlo Grosse</div>
              <div className="text-slate-500">
                Senior Engineer, Hetzner Cloud
              </div>
            </div>

            <HetznerCloudIcon
              aria-hidden="true"
              className="mx-auto size-10 flex-none shrink-0 bg-white text-[#D50C2D]"
            />
          </figcaption>
        </figure>
        <figure className="mt-16 flex flex-col justify-between rounded-lg bg-white p-4 pl-8 dark:bg-slate-950">
          <blockquote className="text-base/7">
            <p>
              "Maintaining our own CI was not efficient. With Nx Cloud our
              developers can focus on the things that actually matter for DevEx
              and create a good experience for our customers."
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

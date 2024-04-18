import { SectionHeading } from './temp/typography';
import {
  BoltIcon,
  ChevronDoubleRightIcon,
  UsersIcon,
  WrenchIcon,
} from '@heroicons/react/24/outline';

export function EnterpriseAddons(): JSX.Element {
  return (
    <section>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <SectionHeading as="h2" variant="title" id="enterprise-addons">
            Nx Enterprise is the monorepo solution for organizations.
          </SectionHeading>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
            <div className="flex flex-col">
              <dt className="text-base font-semibold leading-7 text-black dark:text-white">
                <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-black dark:bg-white">
                  <BoltIcon
                    className="h-6 w-6 text-white dark:text-black"
                    aria-hidden="true"
                  />
                </div>
                Move fast, move together
              </dt>
              <dd className="mt-1 flex flex-auto flex-col text-base leading-7">
                <p className="flex-auto">
                  Multiply the power of Nx with an Nx Enterprise partnership to
                  accelerate your organization's journey to tighter
                  collaboration, better developer experience, and speed…lots of
                  speed.
                </p>
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-base font-semibold leading-7 text-black dark:text-white">
                <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-black dark:bg-white">
                  <UsersIcon
                    className="h-6 w-6 text-white dark:text-black"
                    aria-hidden="true"
                  />
                </div>
                No trial and error necessary
              </dt>
              <dd className="mt-1 flex flex-auto flex-col text-base leading-7">
                <p className="flex-auto">
                  With the help of the developers of Nx, you'll use Nx and Nx
                  Cloud to its full potential, the first time. No matter how
                  long you've been using Nx, we'll find ways to make it more
                  powerful.
                </p>
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-base font-semibold leading-7 text-black dark:text-white">
                <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-black dark:bg-white">
                  <ChevronDoubleRightIcon
                    className="h-6 w-6 text-white dark:text-black"
                    aria-hidden="true"
                  />
                </div>
                Migrate to Nx & Nx Cloud
              </dt>
              <dd className="mt-1 flex flex-auto flex-col text-base leading-7">
                <p className="flex-auto">
                  Lorem ipsum, dolor sit amet consectetur adipisicing elit.
                  Maiores impedit perferendis suscipit eaque.Lorem ipsum, dolor
                  sit amet consectetur adipisicing elit. Maiores impedit
                  perferendis suscipit eaque.
                </p>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

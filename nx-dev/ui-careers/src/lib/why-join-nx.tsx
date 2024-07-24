import {
  BeakerIcon,
  GlobeAltIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { SectionHeading } from '@nx/nx-dev/ui-common';

const features = [
  {
    name: 'Live and work in places you love',
    description:
      "You get to decide when and how you work best. Whether you want to spend a week working remotely from a coffee shop in Barcelona, or you're a night owl who wants to work in the evening - it’s your choice. You know what makes you most productive and happy. Do that!",
    icon: GlobeAltIcon,
  },
  {
    name: 'Work on open source and SaaS projects',
    description:
      "You can work on Nx and Lerna - open source build tools used by millions of developers. You can also work on Nx Cloud - a SaaS product. You won't be bored.",
    icon: BeakerIcon,
  },
  {
    name: 'Trust your company and your colleagues',
    description:
      'We value transparency and honesty. Everyone knows how much money the company is making. Everyone knows how much everyone else is making. We don’t have behind the scenes negotiations, departmental silos or company politics.',
    icon: UserGroupIcon,
  },
];

export function WhyJoinNx(): JSX.Element {
  return (
    <article id="our-focus">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mx-auto max-w-3xl text-center">
          <SectionHeading as="h2" variant="title">
            Why join Nx?
          </SectionHeading>
          <SectionHeading as="p" variant="subtitle" className="mt-6">
            We don’t care about your resume: where you worked at and how many
            years of experience you have. What matters to us is whether you are
            a great engineer who can do amazing work.
          </SectionHeading>
        </header>

        <dl className="mt-24 grid grid-cols-1 gap-16 lg:grid lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.name}>
              <dt>
                <feature.icon
                  className="h-8 w-8 text-blue-500 dark:text-sky-500"
                  aria-hidden="true"
                />
                <p className="mt-4 text-lg font-semibold leading-8 tracking-tight text-slate-800 dark:text-slate-200">
                  {feature.name}
                </p>
              </dt>
              <dd className="mt-2 text-slate-500 dark:text-slate-400">
                <p className="text-base leading-7">{feature.description}</p>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}

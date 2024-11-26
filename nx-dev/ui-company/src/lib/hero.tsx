import { SectionHeading } from '@nx/nx-dev/ui-common';
import {
  GlobeAltIcon,
  TrophyIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

const statements = [
  {
    title: 'Globally Distributed',
    icon: GlobeAltIcon,
    description: 'We are spread across the USA, Canada, UK, and Europe.',
  },
  {
    title: 'Leaders',
    icon: TrophyIcon,
    description:
      "Nx was founded by former Googlers, Jeff Cross and Victor Savkin. Today we're a growing team of experts creating build tools used by millions of people.",
  },
  {
    title: 'Experts',
    icon: UserGroupIcon,
    description:
      "Since 2016 we've been helping global enterprises use build tools to optimize their development processes, speed up their CI and create better software.",
  },
];
export function Hero(): JSX.Element {
  return (
    <section>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading as="h1" variant="display">
            About us
          </SectionHeading>
          <SectionHeading
            as="p"
            variant="subtitle"
            className="mx-auto mt-6 max-w-3xl"
          >
            We make developers
            <span className="mx-1 text-gray-500 line-through">10x</span>
            Nx more productive
          </SectionHeading>
        </div>
        <dl className="mt-24 grid grid-cols-1 gap-16 lg:grid lg:grid-cols-3">
          {statements.map((statement, _) => {
            return (
              <div key={statement.title}>
                <dt>
                  <statement.icon className="h-8 w-8 text-blue-500 dark:text-sky-500" />
                  <p className="mt-4 text-lg font-semibold leading-8 tracking-tight text-slate-800 dark:text-slate-200">
                    {statement.title}
                  </p>
                </dt>
                <dd className="mt-4 text-slate-500 dark:text-slate-400">
                  <p className="leading 7 text-base">{statement.description}</p>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}

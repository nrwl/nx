import { CheckIcon } from '@heroicons/react/24/outline';
import { SectionHeading } from '@nx/nx-dev/ui-common';

const features = [
  {
    name: 'Vacation and Sick Days',
    description:
      'Four weeks of paid vacation + unlimited sick days. Paid regional holidays. Spend more time with your family and friends.',
  },
  {
    name: 'Remote Work',
    description:
      'Office space paid for by the company in Phoenix. Or work from home, work from anywhere you want.',
  },
  {
    name: 'Competitive Salaries',
    description:
      'We pay really well because we want you to live comfortably. Salaried employment with benefits - not hourly contracts.',
  },
  {
    name: 'Flexibility at Work',
    description:
      'You control your work hours. Run an errand or walk your dog during the day if you need to.',
  },
  {
    name: 'Health, Dental, & Vision Insurance',
    description:
      'We offer plans for all employees. Canadian employees also get an HSA account.',
  },
  {
    name: 'No Red Tape Attitude Towards Expenses',
    description:
      'Get the best hardware, software, supplies & books. No pre-approval for small purchases. Phone and internet reimbursement.',
  },
  {
    name: 'Exceptional Career Development',
    description:
      'Expenses and time off provided for conference attendance and speaking. Write blog posts and books. Meet exceptional folks leading software communities and build your reputation.',
  },
];

export function WhatWeOffer(): JSX.Element {
  return (
    <article className="mx-auto max-w-7xl px-6 lg:grid lg:grid-cols-3 lg:gap-x-12 lg:px-8">
      <header>
        <SectionHeading as="h2" variant="title">
          What we offer
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Work/life, balanced
        </SectionHeading>
      </header>

      <div className="mt-20 lg:col-span-2 lg:mt-0">
        <dl className="grid grid-cols-1 gap-12 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-4">
          {features.map((feature) => (
            <div key={feature.name} className="relative">
              <dt>
                <CheckIcon
                  className="absolute mt-1 h-6 w-6 text-blue-500 dark:text-sky-500"
                  aria-hidden="true"
                />
                <p className="ml-10 text-lg font-semibold leading-8 tracking-tight text-slate-800 dark:text-slate-200">
                  {feature.name}
                </p>
              </dt>
              <dd className="ml-10 mt-2 text-base leading-7">
                {feature.description}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}

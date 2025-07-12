import { ReactElement } from 'react';
import { SectionHeading } from '@nx/nx-dev-ui-common';
import { CiBottleneckAnimation } from './ci-bottleneck-animation';

const stats = [
  { id: 1, name: 'Increase in PR volume with AI tools', value: '37%' },
  { id: 2, name: 'Productivity loss from context switching*', value: '40%' },
  { id: 3, name: 'To regain deep focus after interruption*', value: '23 min' },
  { id: 4, name: 'Task switches per hour for developers*', value: '13' },
];

export function CiBottleneck(): ReactElement {
  return (
    <section
      id="ci-bottleneck"
      className="scroll-mt-24 border-b border-t border-slate-200 bg-slate-50 py-24 sm:py-32 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading as="h2" variant="title" id="ci-bottle-neck-title">
            The Problem Isn't Just Writing Code —{' '}
            <span className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
              It's Merging It.
            </span>
          </SectionHeading>
          <SectionHeading as="p" variant="subtitle" className="mt-8">
            Your scaling investments won't pay off if your CI becomes your
            bottleneck.
          </SectionHeading>
          <SectionHeading as="p" variant="subtitle" className="sr-only mt-8">
            Your team is producing code faster than ever. Growing teams and AI
            tooling are supposed to help you scale, but they're not efficient
            when met with this bottleneck: your CI is getting too complex.
          </SectionHeading>
        </div>

        <div className="relative isolate mx-auto mt-24 max-w-3xl">
          <CiBottleneckAnimation />
        </div>

        <div className="mt-24">
          <dl className="grid grid-cols-1 gap-0.5 overflow-hidden rounded-2xl text-center sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.id}
                className="flex flex-col bg-white p-8 dark:bg-white/5"
              >
                <dt className="text-sm/6 font-semibold text-slate-700 dark:text-slate-300">
                  {stat.name}
                </dt>
                <dd className="order-first text-3xl font-semibold tracking-tight text-black dark:text-white">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 text-center text-xs italic">
            * Source: Academic research from MIT, Princeton, UC Irvine, and Peer
            reviewed studies.
          </p>
        </div>
      </div>
    </section>
  );
}

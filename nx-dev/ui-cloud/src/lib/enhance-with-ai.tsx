import {
  AcademicCapIcon,
  CircleStackIcon,
  CloudArrowDownIcon,
  CodeBracketIcon,
  HeartIcon,
  RectangleGroupIcon,
  ServerStackIcon,
} from '@heroicons/react/24/outline';
import { SectionHeading } from '@nx/nx-dev/ui-common';
import Link from 'next/link';
import { ReactElement } from 'react';

const features = [
  {
    name: 'Self-healing CI',
    description:
      'Automatically fix flaky tests, letting you merge with confidence and eliminating wasted time babysitting PRs.',
    icon: HeartIcon,
    isAvailable: false,
    link: '',
  },
  {
    name: 'AI data analysis',
    description:
      'Ask questions about your runs and tasks in natural language. Get real-time, data-driven answers to "Why did this build slow down?" or "Which tests are the flakiest this week?"',
    icon: CircleStackIcon,
    isAvailable: false,
    link: '',
  },
  {
    name: 'Nx MCP (Model Context Protocol)',
    description:
      'Gives your AI assistant the "map" it needs. Make your AI understand your workspace structure, enabling faster and more reliable coding, debugging, and refactoring.',
    icon: AcademicCapIcon,
    isAvailable: true,
    link: '/features/enhance-ai',
  },
  {
    name: 'Dynamic Nx Agent sizing',
    description:
      'Automatically scale the number and size of Nx Agents to match your workload, perfectly balancing CI speed and infrastructure cost without any manual configuration.',
    icon: ServerStackIcon,
    isAvailable: false,
    link: '',
  },
  {
    name: 'Task cache miss diagnosis',
    description:
      "Instantly understand why a cache miss occurred and get clear instructions on how to fix it, maximizing your team's caching efficiency.",
    icon: CloudArrowDownIcon,
    isAvailable: false,
    link: '',
  },
  {
    name: 'Organization insights',
    description:
      "Get a bird's-eye view of your teams' workspaces. Understand shared code usage, identify cross-team bottlenecks, and enforce architectural consistency across your entire organization.",
    icon: RectangleGroupIcon,
    isAvailable: false,
    link: '',
  },
  {
    name: 'AI explainer',
    description:
      'Get clear, actionable explanations for complex CI errors directly in your task logs. Stop deciphering cryptic messages and start fixing the root cause.',
    icon: CodeBracketIcon,
    isAvailable: true,
    link: '/ci/features/explain-with-ai',
  },
];

export function EnhancedWithAi(): ReactElement {
  return (
    <section id="ai-for-your-ci" className="scroll-mt-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading as="h2" variant="title" id="deep-understanding">
            AI for your CI
          </SectionHeading>
          <SectionHeading as="p" variant="subtitle" className="mt-6">
            With the knowledge of your workspace structure, your CI and commit
            history, Nx Cloud can optimize CI resource usage, help resolve
            issues, provide powerful analytics and suggest refactorings.
          </SectionHeading>
        </div>
        <dl className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:mt-20 md:grid-cols-2 lg:mt-24 lg:gap-12">
          {features.map((feature) => (
            <div key={feature.name} className="relative pl-9">
              <dt className="flex items-center gap-4 text-base font-semibold leading-7 text-slate-950 dark:text-white">
                <feature.icon
                  className="absolute left-1 top-1 h-5 w-5"
                  aria-hidden="true"
                />
                {feature.name}
                {!feature.isAvailable && (
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30">
                    Coming soon
                  </span>
                )}
              </dt>
              <dd className="mt-2 text-base leading-7">
                {feature.description}
              </dd>
              {feature.link ? (
                <Link
                  href={feature.link}
                  title="Learn more"
                  prefetch={false}
                  className="group mt-4 text-sm font-medium leading-6 text-slate-950 dark:text-white"
                >
                  See documentation{' '}
                  <span
                    aria-hidden="true"
                    className="inline-block transition group-hover:translate-x-1"
                  >
                    →
                  </span>
                </Link>
              ) : null}
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

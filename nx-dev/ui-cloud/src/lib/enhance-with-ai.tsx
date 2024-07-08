import {
  CloudArrowDownIcon,
  CodeBracketIcon,
  RectangleGroupIcon,
  ServerStackIcon,
} from '@heroicons/react/24/outline';
import { SectionHeading } from './elements/section-tags';

const features = [
  {
    name: 'Task error insights',
    description:
      "Debug task errors on your CI pipeline directly in your pipeline's UI.",
    icon: CodeBracketIcon,
  },
  {
    name: 'Dynamic Nx Agent sizing',
    description:
      "Automatically adjust Nx Agents' resource classes and numbers depending on your workspace usage and needs.",
    icon: ServerStackIcon,
  },
  {
    name: 'Task cache miss diagnosis',
    description: 'Understand why a task has a cache miss and how to fix it.',
    icon: CloudArrowDownIcon,
  },
  {
    name: 'Organization insights',
    description:
      "Understand your teams' workspaces: shared code usage, ownership, bottlenecks.",
    icon: RectangleGroupIcon,
  },
];

export function EnhancedWithAi(): JSX.Element {
  return (
    <section id="ai-for-your-ci">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30">
            Coming soon
          </span>
          <SectionHeading as="h2" variant="title" id="deep-understanding">
            AI for your CI
          </SectionHeading>
          <SectionHeading as="p" variant="subtitle" className="mt-6">
            With the knowledge of your workspace structure, your CI and commit
            history, Tusky AI can optimize CI resource usage, help resolve
            issues, provide powerful analytics and suggest refactorings.
          </SectionHeading>
        </div>
        <dl className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:mt-20 md:grid-cols-2 lg:mt-24 lg:gap-12">
          {features.map((feature) => (
            <div key={feature.name} className="relative pl-9">
              <dt className="text-base font-semibold leading-7 text-slate-950 dark:text-white">
                <feature.icon
                  className="absolute left-1 top-1 h-5 w-5"
                  aria-hidden="true"
                />
                {feature.name}
              </dt>
              <dd className="mt-2 text-base leading-7">
                {feature.description}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

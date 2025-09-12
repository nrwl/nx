import {
  CommandLineIcon,
  EyeIcon,
  PuzzlePieceIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { ReactElement } from 'react';
import { SectionHeading } from '@nx/nx-dev-ui-common';
import Link from 'next/link';

const features = [
  {
    name: 'Reduce time to meaningful feedback',
    description: (
      <p className="flex-auto">
        <Link
          href="/blog/nx-editor-ci-llm-integration#why-this-matters-optimizing-time-to-meaningful-feedback"
          title="Nx allows you to stream test errors and logs to your editor while CI is still running"
          prefetch={false}
          className="underline"
        >
          Stream test errors and logs to your editor while CI is still running
        </Link>
        , helping you iterate faster and avoid unnecessary context switching.
      </p>
    ),
    icon: EyeIcon,
  },
  {
    name: 'Powerful local tooling',
    description: (
      <>
        <p className="flex-auto">
          Work faster with deep editor integrations, an AI-enabled terminal UI,
          and a fast, Rust-based task orchestrator.
        </p>
        <div className="mt-4">
          <Link
            href="/getting-started/editor-setup"
            title="Learn about Nx Console"
            className="text-sm/6 font-semibold"
          >
            Learn about Nx Console <span aria-hidden="true">→</span>
          </Link>
        </div>
      </>
    ),
    icon: CommandLineIcon,
  },
  {
    name: 'AI LLM integrations',
    description: (
      <>
        <p className="flex-auto">
          Enable your AI assistant to move beyond local file changes with
          architectural awareness, best practices context, and deep integration
          into your CI and local tooling.
        </p>
        <div className="mt-4">
          <Link
            href={
              process.env.NEXT_PUBLIC_ASTRO_URL
                ? '/docs/features/enhance-ai'
                : '/features/enhance-AI'
            }
            title="Learn about Enhancing your LLM"
            className="text-sm/6 font-semibold"
          >
            Learn about Enhancing your LLM <span aria-hidden="true">→</span>
          </Link>
        </div>
      </>
    ),
    icon: SparklesIcon,
  },
  {
    name: 'Plugin support',
    description: (
      <>
        <p className="flex-auto">
          Bring your stack and extend Nx to fit your needs.
        </p>
        <div className="mt-4">
          <Link
            href="/plugin-registry"
            title="View our Plugin Registry"
            className="text-sm/6 font-semibold"
          >
            View our Plugin Registry <span aria-hidden="true">→</span>
          </Link>
        </div>
      </>
    ),
    icon: PuzzlePieceIcon,
  },
];

export function DeveloperExperienceThatWorksForYou(): ReactElement {
  return (
    <div
      id="developer-experience-that-works-for-you"
      className="mx-auto max-w-7xl scroll-mt-32 px-6 lg:px-8"
    >
      <div className="mx-auto max-w-2xl lg:mx-0">
        <div className="h-8 w-36 border-t-2 border-pink-500 dark:border-fuchsia-500" />
        <SectionHeading
          as="h2"
          variant="title"
          id="developer-experience-that-works-for-you-title"
        >
          Developer Experience That Works for You
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Great DX means more focus, less frustration.
        </SectionHeading>
      </div>
      <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
        <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.name} className="flex flex-col">
              <dt className="text-base/7 font-semibold">
                <div className="mb-6 flex size-10 items-center justify-center rounded-lg bg-pink-500 dark:bg-fuchsia-500">
                  <feature.icon
                    aria-hidden="true"
                    className="size-6 text-white"
                  />
                </div>
                {feature.name}
              </dt>
              <dd className="mt-1 flex flex-auto flex-col text-base/7">
                {feature.description}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

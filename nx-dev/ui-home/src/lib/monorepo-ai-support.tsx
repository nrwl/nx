import { SectionHeading, Strong, TextLink } from '@nx/nx-dev/ui-common';
import { ReactElement } from 'react';
import {
  AngularIcon,
  CursorIcon,
  GithubCopilot,
  GoIcon,
  IntellijAiIcon,
  JavaIcon,
  NodeIcon,
  ReactIcon,
  StorybookIcon,
  TypeScriptIcon,
} from '@nx/nx-dev/ui-icons';
import Image from 'next/image';

export function MonorepoAiSupport(): ReactElement {
  return (
    <article className="mx-auto max-w-7xl px-6 lg:px-8">
      <SectionHeading
        as="h2"
        variant="title"
        id="achieve-more-ship-quicker"
        className="scroll-mt-24"
      >
        Promote your LLM from Junior Dev to Chief Architect
      </SectionHeading>
      <div className="max-w-5xl">
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          AI-powered coding assistants can edit files, but they're blind to the
          bigger picture –{' '}
          <Strong>
            they don't understand how your entire codebase fits together
          </Strong>
          . Nx changes that.
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          With full visibility into your{' '}
          <Strong>
            monorepo's project relationships, dependencies, and ownership
          </Strong>
          ,{' '}
          <TextLink href="/features/enhance-AI?utm_source=homepage&utm_medium=website&utm_campaign=homepage_links&utm_content=cta_enhance_ai">
            Nx enables your LLM to move beyond local file changes
          </TextLink>{' '}
          to make <Strong>informed architectural decisions</Strong>.
          Future-proof your development with system-wide intelligence, not just
          AI-friendly tools.
        </SectionHeading>
      </div>

      <div className="relative mt-12 grid grid-cols-1 gap-x-0 sm:grid-cols-2 lg:grid-cols-3">
        <div
          className="pointer-events-none absolute inset-x-0 top-10 -z-10 hidden transform-gpu justify-center overflow-hidden blur-3xl lg:flex"
          aria-hidden="true"
        >
          <div
            className="aspect-[16/9] w-[50rem] flex-none bg-gradient-to-r from-[#80caff] to-[#4f46e5] opacity-15"
            style={{
              clipPath:
                'polygon(73.6% 51.7%, 91.7% 11.8%, 100% 46.4%, 97.4% 82.2%, 92.5% 84.9%, 75.7% 64%, 55.3% 47.5%, 46.5% 49.4%, 45% 62.9%, 50.3% 87.2%, 21.3% 64.1%, 0.1% 100%, 5.4% 51.1%, 21.4% 63.9%, 58.9% 0.2%, 73.6% 51.7%)',
            }}
          />
        </div>
        <div className="absolute inset-0 hidden grid-cols-1 place-items-center lg:grid">
          <Image
            src="/images/home/nx-ai-light-lighting.avif"
            width={1200}
            height={239}
            alt="nx-ai-llm"
            className="max-w-[40%] lg:max-w-[45%] dark:hidden"
          />
          <Image
            src="/images/home/nx-ai-dark-lighting.avif"
            width={1200}
            height={239}
            alt="nx-ai-llm"
            className="hidden max-w-[40%] lg:max-w-[45%] dark:block"
          />
        </div>
        <div className="relative hidden text-slate-500 lg:block">
          <ProjectGraph />

          <ReactIcon
            aria-hidden="true"
            className="absolute left-[12%] top-[28%] size-5 lg:size-8"
          />
          <TypeScriptIcon
            aria-hidden="true"
            className="absolute left-[36%] top-[16%] size-5 lg:size-8"
          />
          <JavaIcon
            aria-hidden="true"
            className="absolute right-[36%] top-[24%] size-5 lg:size-8"
          />
          <StorybookIcon
            aria-hidden="true"
            className="absolute right-[4%] top-[36%] size-5 lg:size-8"
          />
          <AngularIcon
            aria-hidden="true"
            className="absolute bottom-[24%] left-[16%] size-5 lg:size-8"
          />
          <GoIcon
            aria-hidden="true"
            className="absolute bottom-[10%] left-[40%] size-5 lg:size-10"
          />
          <NodeIcon
            aria-hidden="true"
            className="absolute bottom-[24%] right-0 size-5 lg:size-8"
          />
        </div>
        <div className="hidden flex-col items-center justify-center sm:flex">
          <div className="relative text-slate-100 dark:text-slate-950">
            <Image
              src="/images/home/nx-ai.avif"
              width={1200}
              height={1200}
              alt="nx-ai-llm"
              className="block"
            />
            <GithubCopilot
              aria-hidden="true"
              className="absolute bottom-[32%] right-[57%] size-5 sm:size-8"
            />
            <IntellijAiIcon
              aria-hidden="true"
              className="absolute bottom-[32%] right-[45%] size-5 sm:size-8"
            />
            <CursorIcon
              aria-hidden="true"
              className="absolute bottom-[32%] right-[34%] size-5 sm:size-8"
            />
          </div>
        </div>
        <div className="relative flex flex-col items-center justify-center gap-6">
          <div className="flex w-full flex-col rounded-lg border-slate-200 bg-white px-4 py-2 opacity-85 shadow-sm transition-all hover:opacity-100 dark:bg-slate-900">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Instant impact analysis
              </span>
            </div>
            <p className="mt-1.5 text-sm font-normal text-slate-900 dark:text-white">
              If I update this shared library, what downstream projects will
              break?
            </p>
          </div>
          <div className="flex w-full flex-col rounded-lg border-slate-200 bg-white px-4 py-2 opacity-85 shadow-sm transition-all hover:opacity-100 dark:bg-slate-900">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Ownership clarity
              </span>
            </div>
            <p className="mt-1.5 text-sm font-normal text-slate-900 dark:text-white">
              Who maintains this module, and what other teams rely on it?
            </p>
          </div>
          <div className="flex w-full flex-col rounded-lg border-slate-200 bg-white px-4 py-2 opacity-85 shadow-sm transition-all hover:opacity-100 dark:bg-slate-900">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Cross-stack reasoning
              </span>
            </div>
            <p className="mt-1.5 text-sm font-normal text-slate-900 dark:text-white">
              How does this frontend change impact our backend services?
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function ProjectGraph(): ReactElement {
  return (
    <div className="space-y-2 p-4">
      <div className="mx-auto max-w-[300px] text-center uppercase">
        Project Graph
      </div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 491 440"
        className="mx-auto block max-h-[300px] max-w-[300px]"
      >
        <rect
          width="180"
          height="85"
          y="189.658"
          fill="currentColor"
          fillOpacity=".08"
          rx="11.9521"
        />
        <rect
          width="179.281"
          height="83.6644"
          x=".664"
          y="190.322"
          stroke="currentColor"
          strokeOpacity=".5"
          strokeWidth="1.328"
          rx="11.288"
        />
        <path
          stroke="currentColor"
          strokeWidth="1.328"
          d="M87.6484 190.323v-24.568c0-7.335 5.9457-13.28 13.2796-13.28h130.809c7.334 0 13.28-5.946 13.28-13.28V.418"
        />
        <rect
          width="180.609"
          height="84.9924"
          fill="currentColor"
          fillOpacity=".08"
          rx="11.9521"
          transform="matrix(-1 0 0 1 490.695 190.322)"
        />
        <rect
          width="179.281"
          height="83.6644"
          x="-.664"
          y=".664"
          stroke="currentColor"
          strokeOpacity=".5"
          strokeWidth="1.328"
          rx="11.288"
          transform="matrix(-1 0 0 1 489.367 190.322)"
        />
        <rect
          width="180.609"
          height="84.9924"
          fill="currentColor"
          fillOpacity=".08"
          rx="11.9521"
          transform="matrix(-1 0 0 1 490.695 354.332)"
        />
        <rect
          width="179.281"
          height="83.6644"
          x="-.664"
          y=".664"
          stroke="currentColor"
          strokeOpacity=".5"
          strokeWidth="1.328"
          rx="11.288"
          transform="matrix(-1 0 0 1 489.367 354.332)"
        />
        <path
          stroke="currentColor"
          strokeWidth="1.328"
          d="M403.047 190.987v-24.568c0-7.335-5.946-13.28-13.28-13.28H258.958c-7.334 0-13.28-5.946-13.28-13.28V1.082M398.402 274.65v79.681"
        />
      </svg>
    </div>
  );
}

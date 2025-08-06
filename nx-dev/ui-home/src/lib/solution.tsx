import { CheckIcon } from '@heroicons/react/24/outline';
import { SectionHeading } from '@nx/nx-dev-ui-common';
import Link from 'next/link';
import {
  CasewareIcon,
  HetznerCloudIcon,
  PayfitIcon,
  SiriusxmAlternateIcon,
  UkgIcon,
} from '@nx/nx-dev-ui-icons';
import { ReactElement } from 'react';

export function Solution(): ReactElement {
  return (
    <article>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeading as="h2" variant="title" id="" className="scroll-mt-24">
          Skip the tedium. Get to coding.
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          We built Nx, an open-source build platform to solve exactly these
          problems. Drop it into any codebase and it immediately maps your
          project structure, delivering:
        </SectionHeading>
        <ul className="mt-6 flex flex-col gap-4">
          <ChecklistItem
            title="Lightning-fast builds"
            description="through intelligent caching and task distribution"
          />
          <ChecklistItem
            title="PRs that fix themselves"
            description="with AI-powered self-healing that fix broken code and flaky tests"
          />
          <ChecklistItem
            title="Instant code sharing"
            description="across teams with repo-aware dependency management"
          />
        </ul>
        <p className="mt-12 text-balance text-3xl font-normal tracking-tight text-slate-950 sm:text-5xl dark:text-white">
          Works with <strong>any</strong> tech stack. Works with{' '}
          <strong>any</strong> CI provider.
        </p>
      </div>
      <StatsSection />
    </article>
  );
}

function StatsSection(): ReactElement {
  return (
    <div className="mx-auto mt-20 grid max-w-[100rem] grid-cols-1 justify-center gap-4 px-6 py-8 sm:grid-cols-2 xl:grid-cols-6">
      <StatCard
        title="700+"
        description="projects easily managed at scale"
        company="Caseware"
        link="https://youtu.be/lvS8HjjFwEM"
        color="purple"
      />
      <StatCard
        title="360x"
        description="faster deployments from 5 days to 20 minutes"
        company="PayFit"
        link="/blog/payfit-success-story?utm_source=homepage&utm_medium=website&utm_campaign=homepage_links&utm_content=solution_stats"
        color="violet"
      />
      <StatCard
        title="60x"
        description="faster testing from 20 minutes to seconds"
        company="Hetzner"
        link="/blog/hetzner-cloud-success-story?utm_source=homepage&utm_medium=website&utm_campaign=homepage_links&utm_content=solution_stats"
        color="indigo"
      />
      <StatCard
        title="5x"
        description="faster scaling across teams with rapid iteration"
        company="SiriusXM"
        link="https://youtu.be/Q0ky-8oJcro"
        color="blue"
      />
      <StatCard
        title="Instant"
        description="builds with unified codebase across web and mobile"
        company="UKG"
        link="https://youtu.be/rSC8wihnfP4"
        color="sky"
      />
      <StatCard
        title="44%"
        description="faster CI with Nx Agents unlocking concurrency limits"
        company="Vattenfall"
        link="/blog/nx-agents-changes-the-math?utm_source=homepage&utm_medium=website&utm_campaign=homepage_links&utm_content=solution_stats"
        color="cyan"
      />
    </div>
  );
}

function StatCard({
  title,
  description,
  company,
  link,
  color,
}: {
  title: string;
  description: string;
  company: string;
  link: string;
  color: 'purple' | 'violet' | 'indigo' | 'blue' | 'sky' | 'cyan';
}): ReactElement {
  // https://v3.tailwindcss.com/docs/customizing-colors
  const variants = {
    purple:
      'from-purple-100 to-purple-300 dark:from-purple-950 dark:to-purple-900',
    violet:
      'from-violet-100 to-violet-300 dark:from-violet-950 dark:to-violet-900',
    indigo:
      'from-indigo-100 to-indigo-300 dark:from-indigo-950 dark:to-indigo-900',
    blue: 'from-blue-100 to-blue-300 dark:from-blue-950 dark:to-blue-900',
    sky: 'from-sky-100 to-sky-300 dark:from-sky-950 dark:to-sky-900',
    cyan: 'from-cyan-100 to-cyan-300 dark:from-cyan-950 dark:to-cyan-900',
  };

  return (
    <Link
      href={link}
      className={`w-full transform rounded-lg bg-white bg-gradient-to-br p-6 transition duration-300 hover:scale-105 ${variants[color]}`}
    >
      <SectionHeading as="h3" variant="title" className="mb-2 text-lg">
        {title}
      </SectionHeading>
      <div className="mb-8 font-semibold dark:text-white/50">{description}</div>
      <div className="flex items-center gap-2 text-slate-950 dark:text-white">
        {company === 'Caseware' && (
          <CasewareIcon aria-hidden="true" className="size-10" />
        )}
        {company === 'PayFit' && (
          <PayfitIcon aria-hidden="true" className="size-10" />
        )}
        {company === 'Hetzner' && (
          <HetznerCloudIcon aria-hidden="true" className="size-10" />
        )}
        {company === 'SiriusXM' && (
          <SiriusxmAlternateIcon aria-hidden="true" className="size-10" />
        )}
        {company === 'UKG' && (
          <UkgIcon aria-hidden="true" className="size-10" />
        )}

        <span className="text-xl font-bold">{company}</span>
      </div>
    </Link>
  );
}

function ChecklistItem({
  title,
  description,
}: {
  title: string;
  description: string;
}): ReactElement {
  return (
    <li className="inline-flex items-center text-lg">
      <CheckIcon className="mr-2 h-6 w-6 shrink-0" />
      <span>
        <strong className="mr-1">{title}</strong> <span>{description}</span>
      </span>
    </li>
  );
}

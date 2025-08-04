import { CheckBadgeIcon, CheckIcon } from '@heroicons/react/24/outline';
import { SectionHeading } from '@nx/nx-dev-ui-common';
import Link from 'next/link';
import {
  CasewareIcon,
  HetznerCloudIcon,
  PayfitIcon,
  SiriusxmAlternateIcon,
  SiriusxmIcon,
  UkgIcon,
} from '@nx/nx-dev-ui-icons';
import { ReactElement } from 'react';

export function Solution(): ReactElement {
  return (
    <article className="mx-auto max-w-7xl px-6 lg:px-8">
      <SectionHeading as="h2" variant="title" id="" className="scroll-mt-24">
        Skip the tedium. Get to coding.
      </SectionHeading>
      <SectionHeading as="p" variant="subtitle" className="mt-6">
        We built Nx, an open-source build platform to solve exactly these
        problems. Drop it into any codebase and it immediately maps your project
        structure, delivering:
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

      <StatsSection />
    </article>
  );
}

function StatsSection(): ReactElement {
  return (
    <div className="mt-20 flex flex-nowrap gap-4 overflow-x-scroll py-8">
      <StatCard
        title="700+"
        description="projects easily managed at scale"
        company="Caseware"
        link="https://youtu.be/lvS8HjjFwEM"
        color="purple"
      />
      <StatCard
        title="15x"
        description="faster deployments from 5 days to 20 minutes"
        company="PayFit"
        link="/blog/payfit-success-story"
        color="violet"
      />
      <StatCard
        title="60x"
        description="faster testing from 20 minutes to seconds"
        company="Hetzner"
        link="/blog/hetzner-cloud-success-story"
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
        title="25x"
        description="more concurrency with Nx Agents, 44% faster CI"
        company="Vattenfall"
        link="/blog/nx-agents-changes-the-math"
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
    purple: 'from-purple-100 to-purple-300',
    violet: 'from-violet-100 to-violet-300',
    indigo: 'from-indigo-100 to-indigo-300',
    blue: 'from-blue-100 to-blue-300',
    sky: 'from-sky-100 to-sky-300',
    cyan: 'from-cyan-100 to-cyan-300',
  };

  return (
    <div
      className={`min-w-72 rounded-lg bg-white bg-gradient-to-br p-6 ${variants[color]}`}
    >
      <SectionHeading as="h3" variant="title" className="mb-2 text-lg">
        {title}
      </SectionHeading>
      <div className="mb-8 font-semibold text-slate-500">{description}</div>
      <Link href={link} className="flex items-center gap-2 text-slate-950">
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
        {/* Vattenfall doesn't have a monotone version of their logo */}
        <span className="text-xl font-bold">{company}</span>
      </Link>
    </div>
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
    <li className="flex items-center text-lg">
      <CheckIcon className="mr-2 h-6 w-6 shrink-0" />
      <strong className="mr-1">{title}</strong> <span>{description}</span>
    </li>
  );
}

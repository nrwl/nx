import {
  AcademicCapIcon,
  ArrowPathIcon,
  BoltIcon,
  CircleStackIcon,
  CodeBracketIcon,
  CubeIcon,
  NewspaperIcon,
  PlayCircleIcon,
  ShareIcon,
  Squares2X2Icon,
  ChatBubbleBottomCenterTextIcon,
} from '@heroicons/react/24/outline';
import { FC, SVGProps } from 'react';
import { NxAgentsIcon } from '../nx-agents-icon';
import { NxReplayIcon } from '../nx-replay-icon';
import { DiscordIcon } from '../discord-icon';

export interface MenuItem {
  name: string;
  href: string;
  description: string | null;
  icon: FC<SVGProps<SVGSVGElement>> | null;
  isHighlight: boolean;
  isNew: boolean;
}

export const featuresItems: MenuItem[] = [
  {
    name: 'Task Running',
    // description: 'Run one or many tasks in parallel.',
    description: null,
    href: '/features/run-tasks',
    icon: BoltIcon,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Local Caching',
    // description: 'Speeds up your local workflow.',
    description: null,
    href: '/features/cache-task-results',
    icon: CircleStackIcon,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Nx Graph',
    // description: 'See interactions for tasks and modules.',
    description: null,
    href: '/features/explore-graph',
    icon: ShareIcon,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Automated updates',
    // description: 'Keep running on latest without effort.',
    description: null,
    href: '/features/automate-updating-dependencies',
    icon: ArrowPathIcon,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Module Boundaries',
    // description: 'Partition your code into defined units.',
    description: null,
    href: '/features/enforce-module-boundaries',
    icon: Squares2X2Icon,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Nx Release',
    // description: 'Versioning, changelog, publishing.',
    description: null,
    href: '/features/manage-releases',
    icon: CubeIcon,
    isNew: true,
    isHighlight: false,
  },
  {
    name: 'Nx Replay',
    description: 'Zero-config, fast & secure remote cache solution.',
    href: '/ci/features/remote-cache',
    icon: NxReplayIcon,
    isNew: false,
    isHighlight: true,
  },
  {
    name: 'Nx Agents',
    description:
      'One-line config for distributing tasks, E2E tests split & flaky tasks rerun.',
    href: '/ci/features/distribute-task-execution',
    icon: NxAgentsIcon,
    isNew: true,
    isHighlight: true,
  },
];
export const plans: MenuItem[] = [
  {
    name: 'Nx Cloud',
    description:
      'End-to-end solution for smart, efficient and maintainable CI.',
    href: 'https://nx.app',
    icon: null,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Nx Enterprise',
    description:
      'The ultimate Nx & Nx Cloud toolchain, tailored to your needs.',
    href: '/enterprise',
    icon: null,
    isNew: false,
    isHighlight: false,
  },
];
const useCaseItems: MenuItem[] = [
  {
    name: 'Get actionable feedback',
    description: 'Enhanced analysis & analytics of your workflows.',
    href: '',
    icon: null,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Reduce CI timings with remote caching',
    description: 'Share task results & artifacts between CI & teams.',
    href: '',
    icon: null,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Performant task distribution at scale',
    description: 'Faster & cheaper CI workflows.',
    href: '',
    icon: null,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Improve E2E time execution on CI',
    description: 'Automatic task splitting.',
    href: '',
    icon: null,
    isNew: false,
    isHighlight: false,
  },
];
export const learnItems: MenuItem[] = [
  {
    name: 'Step by step tutorials',
    description: null,
    href: '/getting-started/intro#learn-nx',
    icon: AcademicCapIcon,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Code examples for your stack',
    description: null,
    href: '/showcase/example-repos',
    icon: CodeBracketIcon,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Video tutorials',
    description: null,
    href: 'https://www.youtube.com/@nxdevtools',
    icon: PlayCircleIcon,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Newsletter',
    description: null,
    href: 'https://go.nrwl.io/nx-newsletter',
    icon: NewspaperIcon,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Community',
    description: null,
    href: '/community',
    icon: ChatBubbleBottomCenterTextIcon,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Discord',
    description: null,
    href: 'https://go.nx.dev/community',
    icon: DiscordIcon,
    isNew: false,
    isHighlight: false,
  },
];
export const eventItems: MenuItem[] = [
  {
    name: 'Monorepo World',
    description:
      'In person & virtual conference about the latest monorepo advancements.',
    href: 'https://monorepo.tools/conf',
    icon: null,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Webinars',
    description:
      'Virtual courses to get a deeper understanding on monorepos animated by the Nx team.',
    href: 'https://go.nx.dev/webinar',
    icon: null,
    isNew: false,
    isHighlight: false,
  },
];
export const solutionsMenuItems = {
  'Helping you grow': plans,
  // 'Use cases': useCaseItems
};
export const resourceMenuItems = {
  Learn: learnItems,
  Events: eventItems,
};

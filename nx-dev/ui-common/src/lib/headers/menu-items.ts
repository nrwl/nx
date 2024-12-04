import {
  AcademicCapIcon,
  BoltIcon,
  CircleStackIcon,
  CodeBracketIcon,
  CubeIcon,
  NewspaperIcon,
  PlayCircleIcon,
  ShareIcon,
  Squares2X2Icon,
  ChatBubbleBottomCenterTextIcon,
  ArrowUpCircleIcon,
  UserGroupIcon,
  ComputerDesktopIcon,
  GlobeAltIcon,
  MicrophoneIcon,
  VideoCameraIcon,
  CheckBadgeIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';
import { FC, SVGProps } from 'react';
import { DiscordIcon } from '../discord-icon';
import { BuildingOfficeIcon } from '@heroicons/react/24/solid';
import { NxAgentsIcon, NxReplayIcon } from '@nx/nx-dev/ui-icons';

export interface MenuItem {
  name: string;
  href: string;
  description: string | null;
  icon: FC<SVGProps<SVGSVGElement>> | null;
  isHighlight: boolean;
  isNew: boolean;
}

export const featuresItems: Record<string, MenuItem[]> = {
  '': [
    {
      name: 'Run Tasks',
      // description: 'Run one or many tasks in parallel.',
      description: null,
      href: '/features/run-tasks',
      icon: BoltIcon,
      isNew: false,
      isHighlight: false,
    },
    {
      name: 'Cache Task Results',
      // description: 'Speeds up your local workflow.',
      description: null,
      href: '/features/cache-task-results',
      icon: CircleStackIcon,
      isNew: false,
      isHighlight: false,
    },
    {
      name: 'Explore Your Workspace',
      // description: 'See interactions for tasks and modules.',
      description: null,
      href: '/features/explore-graph',
      icon: ShareIcon,
      isNew: false,
      isHighlight: false,
    },
    {
      name: 'Automate Updating Dependencies',
      // description: 'Keep running on latest without effort.',
      description: null,
      href: '/features/automate-updating-dependencies',
      icon: ArrowUpCircleIcon,
      isNew: false,
      isHighlight: false,
    },
    {
      name: 'Enforce Module Boundaries',
      // description: 'Partition your code into defined units.',
      description: null,
      href: '/features/enforce-module-boundaries',
      icon: Squares2X2Icon,
      isNew: false,
      isHighlight: false,
    },
    {
      name: 'Manage Releases',
      // description: 'Versioning, changelog, publishing.',
      description: null,
      href: '/features/manage-releases',
      icon: CubeIcon,
      isNew: false,
      isHighlight: false,
    },
  ],
  'Nx Cloud Features': [
    {
      name: 'Use Remote Caching (Nx Replay)',
      description: 'Zero-config, fast & secure remote cache solution.',
      href: '/ci/features/remote-cache',
      icon: NxReplayIcon,
      isNew: false,
      isHighlight: false,
    },
    {
      name: 'Distribute Task Execution (Nx Agents)',
      description:
        'One-line config for distributing tasks across multiple machines',
      href: '/ci/features/distribute-task-execution',
      icon: NxAgentsIcon,
      isNew: false,
      isHighlight: false,
    },
  ],
  'Nx Powerpack Features (Paid Enterprise Extensions)': [
    {
      name: 'Run Conformance Rules',
      description: null,
      href: '/nx-enterprise/powerpack/conformance',
      icon: CheckBadgeIcon,
      isNew: false,
      isHighlight: false,
    },
    {
      name: 'Define Project Owners',
      description: null,
      href: '/nx-enterprise/powerpack/owners',
      icon: UserGroupIcon,
      isNew: false,
      isHighlight: false,
    },
  ],
};
export const ossProducts: MenuItem[] = [
  {
    name: 'Nx',
    description: 'Smart Monorepos - Fast CI',
    href: '/getting-started/intro',
    icon: null,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Nx Console',
    description: 'Editor integration for VSCode, Cursor and IntelliJ IDEs',
    href: '/getting-started/editor-setup',
    icon: null,
    isNew: false,
    isHighlight: false,
  },
];

export const enterpriseProducts: MenuItem[] = [
  {
    name: 'Nx Cloud',
    description:
      'Nx Cloud is the end-to-end solution for smart, efficient and maintainable CI',
    href: '/nx-cloud',
    icon: null,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Nx Powerpack',
    description:
      'A suite of paid extensions for the Nx CLI specifically designed for enterprises.',
    href: '/powerpack',
    icon: null,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Nx Enterprise',
    description:
      "Accelerate your organization's journey to tighter collaboration, better developer experience, and speed…lots of speed.",
    href: '/enterprise',
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
    name: 'Podcasts',
    description: null,
    href: '/podcast',
    icon: MicrophoneIcon,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Webinars',
    description: null,
    href: 'https://go.nx.dev/webinar',
    icon: ComputerDesktopIcon,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Nx Video Courses',
    description: null,
    href: '/courses',
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
    description: null,
    href: 'https://monorepo.world',
    icon: GlobeAltIcon,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Live Streams',
    description: null,
    href: 'https://www.youtube.com/@nxdevtools/streams',
    icon: VideoCameraIcon,
    isNew: false,
    isHighlight: false,
  },
];

export const companyItems: MenuItem[] = [
  {
    name: 'About Us',
    description: null,
    href: '/company',
    icon: UserGroupIcon,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Customers',
    description: null,
    icon: BuildingOfficeIcon,
    href: '/customers',
    isNew: false,
    isHighlight: false,
  },
];

export const resourceMenuItems = {
  Learn: learnItems,
  Events: eventItems,
  Company: companyItems,
};

import type { FC, SVGProps } from 'react';
import {
  ComputerDesktopIcon,
  BookOpenIcon,
  MicrophoneIcon,
  CubeIcon,
  AcademicCapIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  ListBulletIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline';

export interface Topic {
  label: string;
  icon: FC<SVGProps<SVGSVGElement>>;
  value: string;
  heading: string;
}

export const ALL_TOPICS: Topic[] = [
  {
    label: 'All',
    icon: ListBulletIcon,
    value: 'All',
    heading: 'All Blogs',
  },
  {
    label: 'Customer Stories',
    icon: BookOpenIcon,
    value: 'customer story',
    heading: 'Customer Stories',
  },
  {
    label: 'Webinars',
    icon: ComputerDesktopIcon,
    value: 'webinar',
    heading: 'Webinars',
  },
  {
    label: 'Podcasts',
    icon: MicrophoneIcon,
    value: 'podcast',
    heading: 'Podcasts',
  },
  {
    label: 'Releases',
    icon: CubeIcon,
    value: 'release',
    heading: 'Release Blogs',
  },
  {
    label: 'Talks',
    icon: ChatBubbleOvalLeftEllipsisIcon,
    value: 'talk',
    heading: 'Talks',
  },
  {
    label: 'Tutorials',
    icon: AcademicCapIcon,
    value: 'tutorial',
    heading: 'Tutorials',
  },
  {
    label: 'Livestreams',
    icon: VideoCameraIcon,
    value: 'livestream',
    heading: 'Livestreams',
  },
];

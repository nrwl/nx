import type { FC, SVGProps } from 'react';
import {
  DocumentTextIcon,
  BookOpenIcon,
  DocumentChartBarIcon,
  ListBulletIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';

export interface ResourceType {
  label: string;
  icon: FC<SVGProps<SVGSVGElement>>;
  value: string;
  heading: string;
}

export const ALL_RESOURCE_TYPES: ResourceType[] = [
  {
    label: 'All',
    icon: ListBulletIcon,
    value: 'All',
    heading: 'All Resources',
  },
  {
    label: 'Whitepapers',
    icon: DocumentTextIcon,
    value: 'whitepaper',
    heading: 'Whitepapers',
  },
  {
    label: 'Books',
    icon: BookOpenIcon,
    value: 'book',
    heading: 'Books',
  },
  {
    label: 'Case Studies',
    icon: DocumentChartBarIcon,
    value: 'case-study',
    heading: 'Case Studies',
  },
  {
    label: 'Cheatsheets',
    icon: AcademicCapIcon,
    value: 'cheatsheet',
    heading: 'Cheatsheets',
  },
];

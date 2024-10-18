import { DefaultLayout, SectionHeading } from '@nx/nx-dev/ui-common';
import {
  learnItems,
  eventItems,
  companyItems,
  MenuItem,
} from '@nx/nx-dev/ui-common';
import { Metadata } from 'next';

interface ResourceCardProps {
  item: MenuItem;
}

export function Hero(): JSX.Element {
  return (
    <section>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading as="h1" variant="display">
            Nx Resources
          </SectionHeading>
          <SectionHeading
            as="p"
            variant="subtitle"
            className="mx-auto mt-6 max-w-3xl"
          >
            Learning ⋅ Events ⋅ Company
          </SectionHeading>
        </div>
      </div>
    </section>
  );
}

function ResourceCard({ item }: ResourceCardProps) {
  return (
    <a
      href={item.href}
      className="flex flex-col items-center rounded-lg bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-800 dark:shadow-gray-700"
    >
      {item.icon && (
        <item.icon className="mb-4 h-12 w-12 text-gray-900 dark:text-gray-100" />
      )}
      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
        {item.name}
      </h3>
      {item.description && (
        <p className="text-center text-sm text-gray-600 dark:text-gray-300">
          {item.description}
        </p>
      )}
    </a>
  );
}

interface ResourceSectionProps {
  title: string;
  items: MenuItem[];
}

function ResourceSection({ title, items }: ResourceSectionProps) {
  return (
    <div className="mt-16">
      <h2 className="mb-8 text-3xl font-bold text-gray-900 dark:text-white">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <ResourceCard key={item.name} item={item} />
        ))}
      </div>
    </div>
  );
}

export const metadata: Metadata = {
  title: 'Resources',
  description:
    'Explore Nx resources including tutorials, code examples, podcasts, and more.',
  openGraph: {
    url: 'https://nx.dev/resources',
    title: 'Nx Resources',
    description:
      'Explore Nx resources including tutorials, code examples, podcasts, and more.',
    images: [
      {
        url: 'https://nx.dev/socials/nx-media.png',
        width: 800,
        height: 421,
        alt: 'Nx: Smart Monorepos · Fast CI',
        type: 'image/jpeg',
      },
    ],
    siteName: 'NxDev',
    type: 'website',
  },
};

export default function Resources() {
  return (
    <DefaultLayout>
      <Hero />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <ResourceSection title="Learn" items={learnItems} />
        <ResourceSection title="Events" items={eventItems} />
        <ResourceSection title="Company" items={companyItems} />
      </div>
    </DefaultLayout>
  );
}

import React from 'react';
import { DefaultLayout, SectionHeading } from '@nx/nx-dev/ui-common';
import {
  learnItems,
  eventItems,
  companyItems,
  MenuItem,
} from '@nx/nx-dev/ui-common';
import { cx } from '@nx/nx-dev/ui-primitives';
import { Metadata } from 'next';

interface ResourceCardProps {
  item: MenuItem;
}

function Hero(): JSX.Element {
  return (
    <section className="relative overflow-hidden py-16 dark:from-slate-900 dark:to-slate-950">
      <div className="mx-auto max-w-3xl text-center">
        <SectionHeading
          as="h1"
          variant="display"
          className="text-6xl font-extrabold tracking-tight"
        >
          Nx Resources
        </SectionHeading>
        <SectionHeading
          as="p"
          variant="subtitle"
          className="mx-auto mt-6 max-w-3xl text-xl text-slate-600 dark:text-slate-400"
        >
          Learning ⋅ Events ⋅ Company
        </SectionHeading>
      </div>
    </section>
  );
}

function ResourceCard({ item }: ResourceCardProps) {
  return (
    <a href={item.href} className="block h-full transform-gpu">
      <div
        className={cx(
          'group relative h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-8',
          'dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-900 dark:hover:shadow-blue-900/20',
          'before:absolute before:inset-0 before:z-0 before:bg-gradient-to-br before:from-blue-50 before:to-transparent before:opacity-0 before:transition-opacity',
          'transition-all duration-300 ease-out',
          'hover:-translate-y-2 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-100/50',
          'hover:before:opacity-100 dark:before:from-blue-950'
        )}
      >
        <div className="relative z-10">
          {item.icon && (
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 group-hover:bg-blue-100 dark:bg-slate-800  dark:group-hover:bg-blue-900">
              <item.icon className="h-8 w-8 text-blue-600 transition-transform duration-300 group-hover:scale-110 dark:text-blue-400" />
            </div>
          )}
          <p className="text-xl font-medium text-slate-900 transition-colors duration-200 dark:text-slate-100">
            {item.name}
          </p>
          {item.description && (
            <p className="mt-3 text-slate-600 transition-colors duration-200 dark:text-slate-400">
              {item.description}
            </p>
          )}
        </div>
      </div>
    </a>
  );
}

function ResourceSection({
  title,
  items,
}: {
  title: string;
  items: MenuItem[];
}) {
  return (
    <div className="mt-20">
      <SectionHeading
        as="h2"
        variant="title"
        className="pb-12 text-4xl font-bold tracking-tight"
      >
        {title}
      </SectionHeading>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
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
  alternates: {
    canonical: 'https://nx.dev/resources',
  },
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
        alt: 'Nx: Smart Repos · Fast Builds',
        type: 'image/jpeg',
      },
    ],
    siteName: 'Nx',
    type: 'website',
  },
};

export default function Resources() {
  return (
    <DefaultLayout>
      <Hero />
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-12">
        <ResourceSection title="Learn" items={learnItems} />
        <ResourceSection title="Events" items={eventItems} />
        <ResourceSection title="Company" items={companyItems} />
      </div>
    </DefaultLayout>
  );
}

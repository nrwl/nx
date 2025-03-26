import { DefaultLayout } from '@nx/nx-dev/ui-common';
import {
  CallToAction,
  Features,
  FeatureSections,
  GettingStarted,
  Hero,
  Resources,
} from '@nx/nx-dev/ui-gradle';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nx Gradle Plugin',
  description:
    'Add Nx to your Gradle project for distributed task execution, intelligent caching, and affected commands.',
  alternates: {
    canonical: 'https://nx.dev/gradle',
  },
  openGraph: {
    url: 'https://nx.dev/gradle',
    title: 'Nx Gradle Plugin',
    description:
      'Add Nx to your Gradle project for distributed task execution, intelligent caching, and affected commands.',
    images: [
      {
        url: 'https://nx.dev/socials/nx-gradle-media.png',
        width: 800,
        height: 421,
        alt: 'Nx Gradle Plugin',
        type: 'image/jpeg',
      },
    ],
    siteName: 'Nx',
    type: 'website',
  },
};

export default function GradlePage(): JSX.Element {
  return (
    <DefaultLayout>
      <Hero />

      <div className="mt-16 scroll-mt-16 lg:mt-32">
        <GettingStarted />
      </div>

      <div className="mt-16 scroll-mt-16 lg:mt-32" id="feature-sections">
        <FeatureSections />
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mt-16 scroll-mt-16 lg:mt-32" id="features">
          <Features />
        </div>

        <div className="mt-16 scroll-mt-16 lg:mt-32" id="resources">
          <Resources />
        </div>
      </div>

      <div className="py-16 sm:py-20">
        <CallToAction />
      </div>
    </DefaultLayout>
  );
}

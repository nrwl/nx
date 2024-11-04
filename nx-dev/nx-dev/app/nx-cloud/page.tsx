import {
  Hero,
  TrustedBy,
  FasterAndCheaper,
  UnderstandWorkspace,
  EnhancedWithAi,
  AutomatedAgentsManagement,
  AgentNumberOverTime,
  Statistics,
} from '@nx/nx-dev/ui-cloud';

import { CallToAction, DefaultLayout } from '@nx/nx-dev/ui-common';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nx Cloud',
  description:
    'Nx Cloud is the end-to-end solution for smart, efficient and maintainable CI.',
  openGraph: {
    url: 'https://nx.dev/nx-cloud',
    title: 'Nx Cloud',
    description:
      'Nx Cloud is the end-to-end solution for smart, efficient and maintainable CI.',
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

export default function NxCloudPage(): JSX.Element {
  return (
    <DefaultLayout>
      <Hero />
      <TrustedBy />

      <div className="mt-32 lg:mt-56">
        <FasterAndCheaper />
      </div>
      <div className="mt-32 lg:mt-56">
        <UnderstandWorkspace />
      </div>
      <div className="mt-32 lg:mt-56">
        <EnhancedWithAi />
      </div>
      <div className="mt-32 lg:mt-56">
        <AutomatedAgentsManagement />
      </div>
      <div className="mt-32 lg:mt-56">
        <AgentNumberOverTime />
      </div>
      <div className="mt-32 lg:mt-56">
        <Statistics />
      </div>
      <div className="mt-32 lg:mt-56">
        <CallToAction
          mainActionTitle="Learn more about Nx Cloud on CI"
          mainActionLink="/ci/intro/ci-with-nx"
        />
      </div>
    </DefaultLayout>
  );
}

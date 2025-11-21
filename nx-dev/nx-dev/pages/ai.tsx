import type { Metadata } from 'next';
import { DefaultLayout } from '@nx/nx-dev-ui-common';
import {
  AiHero,
  CallToAction,
  WhileCoding,
  WhileRunningCi,
  WhileScalingYourOrganization,
} from '@nx/nx-dev-ui-ai-landing-page';
import type { ReactElement } from 'react';
import { NextSeo } from 'next-seo';

export function Ai(): ReactElement {
  return (
    <>
      <NextSeo
        title="From your editor to CI, Nx makes your AI a lot more powerful."
        description="Empower your AI assistants with workspace intelligence to understand your codebase structure, project dependencies, and build processes at a glance."
        openGraph={{
          url: 'https://nx.dev/ai',
          title:
            'From your editor to CI, Nx makes your AI a lot more powerful.',
          description:
            'Empower your AI assistants with workspace intelligence to understand your codebase structure, project dependencies, and build processes at a glance.',
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
        }}
        canonical="https://nx.dev/ai"
      />
      <DefaultLayout>
        <AiHero />

        <div className="mt-12 lg:mt-24">
          <WhileCoding />
        </div>
        <div className="mt-32 lg:mt-56">
          <WhileRunningCi />
        </div>
        <div className="mt-32 lg:mt-56">
          <WhileScalingYourOrganization />
        </div>

        <div className="mt-32 lg:mt-56">
          <CallToAction />
        </div>
      </DefaultLayout>
    </>
  );
}

export default Ai;

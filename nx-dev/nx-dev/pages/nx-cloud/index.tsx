'use client';
import { DefaultLayout } from '@nx/nx-dev/ui-common';
import type { ReactElement } from 'react';
import { NextSeo } from 'next-seo';
import {
  CallToAction,
  CiBottleneck,
  CreditPricing,
  CustomerMetrics,
  Faq,
  Features,
  GetStarted,
  NxCloudHero,
  Pricing,
  Security,
  TimeToGreen,
} from '@nx/nx-dev/ui-cloud';

export function NxCloud(): ReactElement {
  return (
    <>
      <NextSeo
        title="Get to green PRs, automatically."
        description="Nx Cloud is the only platform that is smart, scalable, and self-healing so your CI isn’t your bottleneck."
        openGraph={{
          url: 'https://nx.dev/nx-cloud',
          title: 'Get to green PRs, automatically.',
          description:
            'Nx Cloud is the only platform that is smart, scalable, and self-healing so your CI isn’t your bottleneck.',
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
      <DefaultLayout hideBackground={true}>
        <NxCloudHero />

        <div className="">
          <CiBottleneck />
        </div>
        <div className="mt-32 lg:mt-56">
          <TimeToGreen />
        </div>
        <div className="mt-32 lg:mt-56">
          <Features />
        </div>
        <div className="mt-32 lg:mt-56">
          <CustomerMetrics />
        </div>
        <div className="mt-32 lg:mt-56">
          <GetStarted />
        </div>
        <div className="mt-32 lg:mt-56">
          <Security />
        </div>
        <div className="mt-32 lg:mt-56">
          <Pricing />
        </div>
        <div className="mt-32 lg:mt-56">
          <Faq />
        </div>

        <div className="mt-32 lg:mt-56">
          <CallToAction />
        </div>
      </DefaultLayout>
    </>
  );
}

export default NxCloud;

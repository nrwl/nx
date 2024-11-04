import type { Metadata } from 'next';
import {
  StandardPlans,
  ComparablePlans,
  Oss,
  Faq,
} from '@nx/nx-dev/ui-pricing';
import {
  Testimonials,
  TrustedBy,
  DefaultLayout,
  CallToAction,
} from '@nx/nx-dev/ui-common';

export const metadata: Metadata = {
  title: 'Nx Cloud - Available Plans',
  description:
    "Distribute everything, don't waste time waiting on CI. Use Nx Cloud's distributed task execution and caching features to release faster. Save time and money.",
  openGraph: {
    url: 'https://nx.dev/pricing',
    title: 'Nx Cloud - Available Plans',
    description:
      "Distribute everything, don't waste time waiting on CI. Use Nx Cloud's distributed task execution and caching features to release faster. Save time and money.",
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

export default function PricingPage() {
  return (
    <DefaultLayout>
      <StandardPlans />
      <div className="mt-18 lg:mt-32">
        <TrustedBy utmSource="pricingpage" utmCampaign="pricing" />
      </div>
      <div className="mt-32 lg:mt-56">
        <ComparablePlans />
      </div>
      <div className="mt-32 lg:mt-56">
        <Testimonials />
      </div>
      <div className="mt-32 lg:mt-56">
        <Oss />
      </div>
      <div className="mt-32 lg:mt-56">
        <Faq />
      </div>
      <div className="mt-32 lg:mt-56">
        <CallToAction
          mainActionLinkText="Sign up"
          mainActionLink="https://cloud.nx.app?utm_source=nx.dev&utm_medium=cta&utm_campaign=pricing"
          mainActionTitle="Sign up to Nx Cloud"
        />
      </div>
    </DefaultLayout>
  );
}

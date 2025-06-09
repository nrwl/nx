import type { Metadata } from 'next';
import {
  Faq,
  Oss,
  CreditPricing,
  PlansDisplay,
  TrialCallout,
} from '@nx/nx-dev/ui-pricing';
import {
  CallToAction,
  DefaultLayout,
  Testimonials,
  TrustedBy,
} from '@nx/nx-dev/ui-common';
import { gotoAppButton } from '../../lib/components/headerCtaConfigs';

export const metadata: Metadata = {
  title: 'Nx Cloud - Available Plans',
  description:
    "Distribute everything, don't waste time waiting on CI. Use Nx Cloud's distributed task execution and caching features to release faster. Save time and money.",
  alternates: {
    canonical: 'https://nx.dev/pricing',
  },
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
        alt: 'Nx: Smart Repos · Fast Builds',
        type: 'image/jpeg',
      },
    ],
    siteName: 'Nx',
    type: 'website',
  },
};

export default function PricingPage() {
  return (
    <DefaultLayout headerCTAConfig={[gotoAppButton]}>
      <PlansDisplay />
      <div className="mt-18 lg:mt-32">
        <TrustedBy utmSource="pricingpage" utmCampaign="pricing" />
      </div>
      <div className="mt-32 lg:mt-56">
        <TrialCallout pageId="pricing" />
      </div>
      <div className="mt-32 lg:mt-56">
        <CreditPricing />
      </div>
      <div className="mt-32 lg:mt-56">
        <Faq />
      </div>
      <div className="mt-32 lg:mt-56">
        <Oss />
      </div>
      <div className="mt-32 lg:mt-56">
        <Testimonials />
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

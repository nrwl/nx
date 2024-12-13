import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import { DefaultLayout } from '@nx/nx-dev/ui-common';
import {
  CallToAction,
  CustomerLogos,
  CustomerMetrics,
  Hero,
  HetznerCloudTestimonial,
  MakeYourCiFast,
  ScaleOrganizationIntro,
  ScaleYourOrganization,
  Security,
  TestimonialCarousel,
  VmwareTestimonial,
} from '@nx/nx-dev/ui-enterprise';
import { requestFreeTrial } from '../lib/components/headerCtaConfigs';
import { ReactElement } from 'react';

export function Enterprise(): ReactElement {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Solving the Performance Paradox, get speed and scale"
        description="Accelerate your organization's journey to tighter collaboration, better developer experience, and speed…lots of speed."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Solving the Performance Paradox, get speed and scale',
          description:
            "Accelerate your organization's journey to tighter collaboration, better developer experience, and speed…lots of speed.",
          images: [
            {
              url: 'https://nx.dev/socials/nx-media.png',
              width: 800,
              height: 421,
              alt: 'Nx: Smart Monorepos · Fast CI',
              type: 'image/jpeg',
            },
          ],
          siteName: 'Nx',
          type: 'website',
        }}
      />
      <DefaultLayout headerCTAConfig={[requestFreeTrial]} isHome={true}>
        <div>
          <Hero />
          <CustomerLogos />
        </div>
        <CustomerMetrics />
        <div className="mt-32 lg:mt-40">
          <MakeYourCiFast />
        </div>
        <div className="mt-32 lg:mt-40">
          <TestimonialCarousel />
        </div>
        <div className="mt-32 lg:mt-40">
          <ScaleOrganizationIntro />
          <ScaleYourOrganization />
        </div>
        <div className="mt-32 lg:mt-40">
          <HetznerCloudTestimonial />
        </div>
        <div className="mt-32 lg:mt-56">
          <Security />
        </div>
        <div className="mt-32 lg:mt-56">
          <VmwareTestimonial />
        </div>
        <div className="mt-32 lg:mt-40">
          <CallToAction />
        </div>
      </DefaultLayout>
    </>
  );
}

export default Enterprise;

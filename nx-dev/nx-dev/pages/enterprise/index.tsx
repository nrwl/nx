import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import {
  CallToAction,
  CustomerLogos,
  CustomerMetrics,
  EnterpriseLayout,
  Hero,
  HetznerCloudTestimonial,
  MakeYourCiFast,
  ScaleOrganizationIntro,
  ScaleYourOrganization,
  Security,
  TestimonialCarousel,
  VmwareTestimonial,
} from '@nx/nx-dev-ui-enterprise';
import { ReactElement } from 'react';
import { ButtonLinkProps } from '@nx/nx-dev-ui-common';
import { sendCustomEvent } from '@nx/nx-dev-feature-analytics';

export function Enterprise(): ReactElement {
  const router = useRouter();

  const scrollCTAConfig: ButtonLinkProps[] = [
    {
      href: '/enterprise/trial',
      variant: 'primary',
      size: 'small',
      title: 'Request a free trial',
      children: 'Request a free trial',
      onClick: () =>
        sendCustomEvent(
          'request-trial-click',
          'scrolling-header-cta',
          'enterprise'
        ),
    },
  ];

  return (
    <>
      <NextSeo
        title="Develop like an enterprise. Deliver like a startup."
        description="Accelerate your organization's journey to tighter collaboration, better developer experience, and speed…lots of speed."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Develop like an enterprise. Deliver like a startup.',
          description:
            "Accelerate your organization's journey to tighter collaboration, better developer experience, and speed…lots of speed.",
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
      />
      <EnterpriseLayout scrollCTAConfig={scrollCTAConfig}>
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
      </EnterpriseLayout>
    </>
  );
}

export default Enterprise;

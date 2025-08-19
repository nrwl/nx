import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import { ButtonLinkProps, DefaultLayout } from '@nx/nx-dev-ui-common';
import {
  BuildAModernEngineeringOrganization,
  CustomerLogos,
  HetznerCloudTestimonial,
  MaximizeRoi,
  ScaleSafely,
  SolutionsBottomCallToAction,
  SolutionsFaq,
  SolutionsLeadershipHero,
  SolutionsLeadershipTestimonials,
  SolutionsTopCallToAction,
} from '@nx/nx-dev-ui-enterprise';
import { type ReactElement } from 'react';
import { sendCustomEvent } from '@nx/nx-dev-feature-analytics';

export function EnterpriseSolutionsLeadership(): ReactElement {
  const router = useRouter();

  const scrollCTAConfig: ButtonLinkProps[] = [
    {
      href: '/contact/sales',
      variant: 'primary',
      size: 'small',
      title: 'Talk to our team',
      children: 'Talk to our team',
      onClick: () =>
        sendCustomEvent(
          'contact-sales-click',
          'scrolling-header-cta',
          'solutions-leadership'
        ),
    },
  ];

  return (
    <>
      <NextSeo
        title="Fast Delivery. Low Risk. High ROI."
        description="Supercharge engineering ROI with faster delivery, lower CI costs, and fewer risks. Scale safely, future‑proof your stack, and leverage AI‑assisted workflows."
        canonical="https://nx.dev/solutions/leadership"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Fast Delivery. Low Risk. High ROI.',
          description:
            'Supercharge engineering ROI with faster delivery, lower CI costs, and fewer risks. Scale safely, future‑proof your stack, and leverage AI‑assisted workflows.',

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
      <DefaultLayout scrollCTAConfig={scrollCTAConfig}>
        <SolutionsLeadershipHero />
        <CustomerLogos />
        <SolutionsTopCallToAction />
        <div className="mt-32 lg:mt-56">
          <MaximizeRoi />
        </div>
        <div className="mt-32 lg:mt-56">
          <ScaleSafely />
        </div>
        <div className="mt-32 lg:mt-56">
          <HetznerCloudTestimonial />
        </div>
        <div className="mt-32 lg:mt-56">
          <BuildAModernEngineeringOrganization />
        </div>
        <div className="mt-32 lg:mt-56">
          <SolutionsLeadershipTestimonials />
        </div>
        <div className="mt-32 lg:mt-56">
          <SolutionsFaq />
        </div>
        <div className="mt-32 lg:mt-56">
          <SolutionsBottomCallToAction />
        </div>
      </DefaultLayout>
    </>
  );
}

export default EnterpriseSolutionsLeadership;

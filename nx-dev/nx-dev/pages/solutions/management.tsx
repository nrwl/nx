import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import { ButtonLinkProps, DefaultLayout } from '@nx/nx-dev/ui-common';
import {
  CustomerLogos,
  CutDownEngineeringWaste,
  HetznerCloudTestimonial,
  KeepTeamsAligned,
  ScaleWithEase,
  SolutionsManagementHero,
  SolutionsBottomCallToAction,
  SolutionsManagementTestimonials,
  SolutionsFaq,
  SolutionsTopCallToAction,
} from '@nx/nx-dev/ui-enterprise';
import { type ReactElement } from 'react';

export function EnterpriseSolutionsManagement(): ReactElement {
  const router = useRouter();

  const headerCTAConfig: ButtonLinkProps[] = [
    {
      href: '/contact',
      variant: 'secondary',
      size: 'small',
      title: 'Contact us',
      children: 'Contact us',
    },
  ];

  return (
    <>
      <NextSeo
        title="Standardize, scale, and ship with less waste"
        description="Align, scale, and cut engineering waste with Nx. Enable developer mobility, enforce standards, and optimize CI/CD with powerful AI insights."
        canonical="https://nx.dev/solutionss/management"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Standardize, scale, and ship with less waste',
          description:
            'Align, scale, and cut engineering waste with Nx. Enable developer mobility, enforce standards, and optimize CI/CD with powerful AI insights.',
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
      <DefaultLayout headerCTAConfig={headerCTAConfig}>
        <SolutionsManagementHero />
        <CustomerLogos />
        <SolutionsTopCallToAction />
        <div className="mt-32 lg:mt-56">
          <KeepTeamsAligned />
        </div>
        <div className="mt-32 lg:mt-56">
          <ScaleWithEase />
        </div>
        <div className="mt-32 lg:mt-56">
          <HetznerCloudTestimonial />
        </div>
        <div className="mt-32 lg:mt-56">
          <CutDownEngineeringWaste />
        </div>
        <div className="mt-32 lg:mt-56">
          <SolutionsManagementTestimonials />
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

export default EnterpriseSolutionsManagement;

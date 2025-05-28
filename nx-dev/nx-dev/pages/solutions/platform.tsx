import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import { ButtonLinkProps, DefaultLayout } from '@nx/nx-dev/ui-common';
import {
  CostEfficientCompute,
  CustomerLogos,
  EasyToAdoptEasyToMaintain,
  HetznerCloudTestimonial,
  ReliableByDesign,
  SolutionsBottomCallToAction,
  SolutionsFaq,
  SolutionsPlatformHero,
  SolutionsPlatformTestimonials,
  SolutionsTopCallToAction,
} from '@nx/nx-dev/ui-enterprise';
import { type ReactElement } from 'react';

export function EnterpriseSolutionsPlatform(): ReactElement {
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
        title="CI that works out of the box – and stays reliable at scale"
        description="Nx delivers reliable, out-of-the-box CI that scales. Cut costs and boost speed with smart caching, compute distribution, and enhanced security for your pipelines."
        canonical="https://nx.dev/solutionss/platform"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'CI that works out of the box – and stays reliable at scale',
          description:
            'Nx delivers reliable, out-of-the-box CI that scales. Cut costs and boost speed with smart caching, compute distribution, and enhanced security for your pipelines.',
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
        <SolutionsPlatformHero />
        <CustomerLogos />
        <SolutionsTopCallToAction />
        <div className="mt-32 lg:mt-56">
          <EasyToAdoptEasyToMaintain />
        </div>
        <div className="mt-32 lg:mt-56">
          <ReliableByDesign />
        </div>
        <div className="mt-32 lg:mt-56">
          <HetznerCloudTestimonial />
        </div>
        <div className="mt-32 lg:mt-56">
          <CostEfficientCompute />
        </div>
        <div className="mt-32 lg:mt-56">
          <SolutionsPlatformTestimonials />
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

export default EnterpriseSolutionsPlatform;

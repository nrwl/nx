import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import { ButtonLinkProps, DefaultLayout } from '@nx/nx-dev/ui-common';
import {
  AllSpeedNoStress,
  CustomerLogos,
  DeveloperExperienceThatWorksForYou,
  HetznerCloudTestimonial,
  SolutionsBottomCallToAction,
  SolutionsEngineeringHero,
  SolutionsEngineeringTestimonials,
  SolutionsFaq,
  SolutionsTopCallToAction,
} from '@nx/nx-dev/ui-enterprise';
import { type ReactElement } from 'react';

export function EnterpriseSolutionsEngineering(): ReactElement {
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
        title="Build confidently, ship faster – without waiting on your tools."
        description="Build confidently and ship faster with Nx: unleash remote caching, flaky test retries, parallel e2e, dynamic agents, log streaming, powerful tooling, AI LLM integration, and plugins."
        canonical="https://nx.dev/solutionss/engineering"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: '',
          description:
            'Build confidently and ship faster with Nx: unleash remote caching, flaky test retries, parallel e2e, dynamic agents, log streaming, powerful tooling, AI LLM integration, and plugins.',

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
        <SolutionsEngineeringHero />
        <CustomerLogos />
        <SolutionsTopCallToAction />
        <div className="mt-32 lg:mt-56">
          <AllSpeedNoStress />
        </div>
        <div className="mt-32 lg:mt-56">
          <HetznerCloudTestimonial />
        </div>
        <div className="mt-32 lg:mt-56">
          <DeveloperExperienceThatWorksForYou />
        </div>
        <div className="mt-32 lg:mt-56">
          <SolutionsEngineeringTestimonials />
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

export default EnterpriseSolutionsEngineering;

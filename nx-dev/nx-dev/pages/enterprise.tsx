import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import { DefaultLayout } from '@nx/nx-dev/ui-common';
import {
  CallToAction,
  DownloadEbook,
  EnterpriseAddons,
  Hero,
  MetricsAndCustomers,
  ScaleOrganizationsAndPeople,
  Security,
  TrustedBy,
  UnderstandWorkspace,
} from '@nx/nx-dev/ui-enterprise';

export function Enterprise(): JSX.Element {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Enterprise"
        description="DESCRIPTION TEXT HERE"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Enterprise',
          description: 'DESCRIPTION TEXT HERE',
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
        }}
      />
      <DefaultLayout>
        <div>
          <Hero />
        </div>
        <div className="mt-32 lg:mt-40">
          <MetricsAndCustomers />
        </div>
        <div className="mt-32 lg:mt-56">
          <ScaleOrganizationsAndPeople />
        </div>
        <div className="mt-32 lg:mt-56">
          <UnderstandWorkspace />
        </div>
        <div className="mt-32 lg:mt-56">
          <DownloadEbook />
        </div>
        <div className="mt-32 lg:mt-56">
          <EnterpriseAddons />
        </div>
        <div className="mt-32 lg:mt-56">
          <Security />
        </div>
        <div className="mt-32 lg:mt-56">
          <TrustedBy />
        </div>
        <div className="mt-32 lg:mt-56">
          <CallToAction />
        </div>
      </DefaultLayout>
    </>
  );
}

export default Enterprise;

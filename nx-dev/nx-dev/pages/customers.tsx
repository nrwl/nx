import { DefaultLayout } from '@nx/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';

import {
  EnterpriseCustomers,
  Hero,
  OssProjects,
} from '@nx/nx-dev/ui-customers';

export function Customers(): JSX.Element {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Our customers"
        description="Our customers are spread across the USA, Canada, UK, and Europe."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Customers',
          description:
            'Our customers are spread across the USA, Canada, UK, and Europe.',
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
        <div className="mt-32 lg:mt-56">
          <EnterpriseCustomers />
        </div>
        <div className="mt-32 lg:mt-56">
          <OssProjects />
        </div>
      </DefaultLayout>
    </>
  );
}

export default Customers;

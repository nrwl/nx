import {
  CallToAction,
  DefaultLayout,
  ButtonLinkProps,
} from '@nx/nx-dev-ui-common';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import {
  EnterpriseCustomers,
  Hero,
  OssProjects,
} from '@nx/nx-dev-ui-customers';
import { sendCustomEvent } from '@nx/nx-dev-feature-analytics';

export function Customers(): JSX.Element {
  const router = useRouter();

  const scrollCTAConfig: ButtonLinkProps[] = [
    {
      href: '/contact/sales',
      variant: 'primary',
      size: 'small',
      target: '_blank',
      title: 'Book a demo',
      children: 'Book a demo',
      onClick: () =>
        sendCustomEvent(
          'contact-sales-click',
          'scrolling-header-cta-book-demo',
          'customers'
        ),
    },
  ];

  return (
    <>
      <NextSeo
        title="Our customers"
        description="See how companies and open-source projects worldwide use Nx to accelerate development and boost productivity."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Customers',
          description:
            'See how companies and open-source projects worldwide use Nx to accelerate development and boost productivity.',
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
        <div>
          <Hero />
        </div>
        <div className="mt-16">
          <EnterpriseCustomers />
        </div>
        <div className="mt-16 lg:mt-32">
          <OssProjects />
        </div>
        <div className="mt-32 lg:mt-56">
          <CallToAction />
        </div>
      </DefaultLayout>
    </>
  );
}

export default Customers;

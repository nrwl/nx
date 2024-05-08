import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import { Footer, Header } from '@nx/nx-dev/ui-common';
import { TalkToOurSalesTeam } from '@nx/nx-dev/ui-contact';

export function ContactSales(): JSX.Element {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Talk to our Sales team"
        description="We’re here to help you find the right plan and pricing for your requirements. We can talk about how Nx Cloud Enterprise helps you drive better business outcomes."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Talk to our Sales team',
          description:
            'We’re here to help you find the right plan and pricing for your requirements. We can talk about how Nx Cloud Enterprise helps you drive better business outcomes.',
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
      <Header />
      <main id="main" role="main" className="py-24 lg:py-32">
        <div>
          <TalkToOurSalesTeam />
        </div>
      </main>
      <Footer />
    </>
  );
}

export default ContactSales;

import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import { CoFounders, Hero, TheTeam, Layout } from '@nx/nx-dev/ui-company';

export function Company(): JSX.Element {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Who we are"
        description="We create build tools to solve problems for developers, startups and large enterprises."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Company',
          description:
            'We create build tools to solve problems for developers, startups and large enterprises.',
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
      <Layout>
        <div>
          <Hero />
        </div>
        <div className="mt-32 lg:mt-56">
          <CoFounders />
        </div>
        <div className="mt-32 lg:mt-56">
          <TheTeam />
        </div>
      </Layout>
    </>
  );
}

export default Company;

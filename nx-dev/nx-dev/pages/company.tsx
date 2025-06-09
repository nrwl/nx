import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import { CoFounders, Hero, TheTeam, Layout } from '@nx/nx-dev/ui-company';
import { CustomerLogos } from '@nx/nx-dev/ui-enterprise';
import { SectionHeading } from '@nx/nx-dev/ui-common';

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
              alt: 'Nx: Smart Repos · Fast Builds',
              type: 'image/jpeg',
            },
          ],
          siteName: 'Nx',
          type: 'website',
        }}
      />
      <Layout>
        <div>
          <Hero />
          <div className="mx-auto mt-32 max-w-3xl text-center">
            <SectionHeading
              as="h2"
              variant="subtitle"
              id="trusted"
              className="scroll-mt-24 font-medium tracking-tight text-slate-950 sm:text-3xl dark:text-white"
            >
              Trusted by leading OSS projects and Fortune 500 companies.
            </SectionHeading>
          </div>
          <CustomerLogos />
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

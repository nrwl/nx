import { AnnouncementBanner, Footer, Header } from '@nx/nx-dev/ui-common';
import {
  ExtensibleAndIntegrated,
  GettingStarted,
  Hero,
  ImproveWorstCiCase,
  Migrate,
  MigrationsAndCodeGeneration,
  MonorepoStyles,
  Newsletter,
  NxStatistics,
  NxWithCi,
  Testimonials,
} from '@nx/nx-dev/ui-home';
import { NextSeo } from 'next-seo';

export default function Index(): JSX.Element {
  return (
    <>
      <NextSeo
        title="Nx: Smart Monorepos · Fast CI"
        description="Nx is a build system with built-in tooling and advanced CI capabilities. It helps you maintain and scale monorepos, both locally and on CI."
        openGraph={{
          url: 'https://nx.dev',
          title: 'Nx: Smart Monorepos · Fast CI',
          description:
            'Nx is a build system with built-in tooling and advanced CI capabilities. It helps you maintain and scale monorepos, both locally and on CI.',
          images: [
            {
              url: 'https://nx.dev/socials/nx-media.png',
              width: 1200,
              height: 600,
              alt: 'Nx: Smart Monorepos · Fast CI',
              type: 'image/png',
            },
          ],
          siteName: 'Nx',
          type: 'website',
        }}
      />
      <h1 className="sr-only">Next generation monorepo tool</h1>
      {/*<AnnouncementBanner />*/}
      <Header />
      <main id="main" role="main">
        <div className="w-full">
          {/*HERO COMPONENT*/}
          <Hero />
          {/*NX CI*/}
          <NxWithCi />
          {/*NX STATISTICS*/}
          <NxStatistics />
          {/*MONOREPO STYLES*/}
          <MonorepoStyles />
          {/*WORST CASE CI TIMES*/}
          <ImproveWorstCiCase />
          {/*EXTENSIBLE & INTEGRATED*/}
          <ExtensibleAndIntegrated />
          {/*MIGRATE*/}
          <Migrate />
          {/*AFFECTED & CODE GENERATION*/}
          <MigrationsAndCodeGeneration />
          {/*GETTING STARTED*/}
          <GettingStarted />
          {/*TESTIMONIALS*/}
          <Testimonials />
          {/*NEWSLETTER*/}
          <Newsletter />
        </div>
      </main>
      <Footer />
    </>
  );
}

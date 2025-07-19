import { CallToAction, DefaultLayout } from '@nx/nx-dev-ui-common';
import { NextSeo } from 'next-seo';
import {
  CiForMonorepos,
  Hero,
  HetznerCloudTestimonial,
  MonorepoAiSupport,
  SmarterToolsForMonorepos,
  Statistics,
  TeamAndCommunity,
  WorkBetterAchieveMoreShipQuicker,
  Problem,
  Solution,
  FeaturesWhileCoding,
  FeaturesWhileRunningCI,
  FeaturesWhileScalingYourOrganization,
  WrapUpCta,
  CallToActionJuriGraphic,
} from '@nx/nx-dev-ui-home';
import { contactButton } from '../lib/header-cta.configs';

export default function Index(): JSX.Element {
  const headerCTAConfig = [contactButton];

  return (
    <>
      <NextSeo
        title="Nx: Smart Repos · Fast Builds"
        description="Build system, optimized for monorepos, with plugins for popular frameworks and tools and advanced CI capabilities including caching and distribution."
        openGraph={{
          url: 'https://nx.dev',
          title: 'Nx: Smart Repos · Fast Builds',
          description:
            'An AI-first build platform that connects everything from your editor to CI. Helping you deliver fast, without breaking things.',
          images: [
            {
              url: 'https://nx.dev/socials/nx-media.png',
              width: 1200,
              height: 600,
              alt: 'Nx: Smart Repos · Fast Builds',
              type: 'image/png',
            },
          ],
          siteName: 'Nx',
          type: 'website',
        }}
      />
      <h1 className="sr-only">Build system with advanced CI capabilities.</h1>
      <DefaultLayout isHome headerCTAConfig={headerCTAConfig}>
        <Hero />
        <div className="mt-16 lg:-mt-32">
          <Statistics />
        </div>
        <div className="mt-32 lg:mt-56">
          <HetznerCloudTestimonial />
        </div>
        <div className="mt-32 lg:mt-56">
          <Problem />
        </div>
        <div className="mt-32 lg:mt-56">
          <Solution />
        </div>
        <div className="mt-32 lg:mt-56">
          <CallToActionJuriGraphic />
        </div>
        <div className="mt-32 lg:mt-56">
          <FeaturesWhileCoding />
        </div>
        <div className="mt-12 lg:mt-12">
          <FeaturesWhileRunningCI />
        </div>
        <div className="mt-12 lg:mt-12">
          <FeaturesWhileScalingYourOrganization />
        </div>
        <div className="mt-32 lg:mt-56">
          <TeamAndCommunity />
        </div>
        <div className="mb-32 mt-32 lg:mt-56">
          <CallToAction />
        </div>
      </DefaultLayout>
    </>
  );
}

import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import {
  ButtonLinkProps,
  DefaultLayout,
  Footer,
  Header,
} from '@nx/nx-dev/ui-common';
import {
  BuiltForEnterprise,
  CachePoisoningProtection,
  CiAccess,
  FailingCompliance,
  PersonalAccess,
  SecurityCallToAction,
  SecurityHero,
  WhyCiSecurityMatters,
} from '@nx/nx-dev/ui-enterprise';
import { type ReactElement } from 'react';

export function EnterpriseSecurity(): ReactElement {
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
        title="Enterprise-Grade Security, Built Into the Core"
        description="Protect your codebase from artifact poisoning with infrastructure-first security."
        canonical="https://nx.dev/enterprise/security"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Enterprise-Grade Security, Built Into the Core',
          description:
            'Protect your codebase from artifact poisoning with infrastructure-first security.',
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
        <SecurityHero />
        <div className="mt-32 scroll-mt-32 lg:mt-56">
          <WhyCiSecurityMatters />
        </div>
        <div className="mt-32 scroll-mt-32 lg:mt-56">
          <FailingCompliance />
        </div>
        <div className="mt-32 scroll-mt-32 lg:mt-56">
          <CachePoisoningProtection />
        </div>
        <div className="mt-32 scroll-mt-32 lg:mt-56">
          <PersonalAccess />
        </div>
        <div className="mt-32 scroll-mt-32 lg:mt-56">
          <CiAccess />
        </div>
        <div className="mt-32 scroll-mt-32 lg:mt-56">
          <BuiltForEnterprise />
        </div>
        <div className="mt-32 scroll-mt-32 lg:mt-56">
          <SecurityCallToAction />
        </div>
      </DefaultLayout>
    </>
  );
}

export default EnterpriseSecurity;

import { SectionDescription, SectionHeading } from '@nx/nx-dev/ui-common';
import {
  BitoviIcon,
  PushBasedIcon,
  ZyphyrCloudIcon,
  HeroDevsIcon,
  CallstackIcon,
  ESquareIcon,
} from '@nx/nx-dev/ui-icons';
import { Partner } from './partner';
import { useState, useEffect, useMemo } from 'react';

export function PartnersList(): JSX.Element {
  const initialPartners = useMemo(
    () => [
      {
        name: 'Zyphyr Cloud',
        logo: <ZyphyrCloudIcon aria-hidden="true" className="mb-4 h-14" />,
        href: 'https://zephyr-cloud.io/',
        location: 'US',
        tagline: 'The only sane way to do micro-frontends and mini-apps.',
        capabilities: ['SaaS', 'Mobile', 'Web', 'DevOps'],
      },
      {
        name: 'HeroDevs',
        logo: <HeroDevsIcon aria-hidden="true" className="mb-4 h-12" />,
        href: 'https://www.herodevs.com/',
        location: 'US',
        tagline: 'End-of-Life Open Source, Secured.',
        capabilities: ['EOL Support'],
      },
      {
        name: 'Bitovi',
        logo: <BitoviIcon aria-hidden="true" className="mb-4 h-12 w-24" />,
        href: 'https://www.bitovi.com/',
        location: 'US',
        tagline: 'Perfecting digital products',
        capabilities: ['Frontend', 'Backend', 'DevOps', 'AI'],
      },
      {
        name: 'Push Based',
        logo: <PushBasedIcon aria-hidden="true" className="mb-4 h-12" />,
        href: 'https://push-based.io/',
        location: 'EU',
        tagline: 'Your Trusted Source for Nx and Angular Expertise',
        capabilities: ['Angular', 'Nx'],
      },
      {
        name: 'Callstack',
        logo: <CallstackIcon aria-hidden="true" className="mb-4 h-12" />,
        href: 'https://callstack.com/',
        location: 'EU',
        tagline: "We Don't Just Ship Products, We Shape The Space",
        capabilities: ['React Native'],
      },
      {
        name: 'E-Square',
        logo: <ESquareIcon aria-hidden="true" className="mb-4 h-12 w-32" />,
        href: 'https://e-square.io/',
        location: 'EU',
        tagline: 'Developer Experts On Demand',
        capabilities: ['Angular', 'React', 'Node', 'Next.js'],
      },
    ],
    []
  );

  const [partners, setPartners] = useState(initialPartners);

  useEffect(() => {
    setPartners([...initialPartners].sort(() => Math.random() - 0.5));
  }, [initialPartners]);

  return (
    <section>
      <div className="col-span-2 border-y border-slate-200 bg-slate-50 px-6 py-8 md:col-span-4 lg:py-16 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl text-center">
          <dl className="grid grid-cols-1 justify-between gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {partners.map((partner) => (
              <Partner key={partner.name} {...partner} />
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

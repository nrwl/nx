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
        capabilities: ['Upgrades & Migrations', 'Architectural Strategy'],
      },
      {
        name: 'HeroDevs',
        logo: <HeroDevsIcon aria-hidden="true" className="mb-4 h-12" />,
        href: 'https://www.herodevs.com/',
        capabilities: ['Angular', 'EOL Support', 'Staff Augmentation'],
      },
      {
        name: 'Bitovi',
        logo: <BitoviIcon aria-hidden="true" className="mb-4 h-12 w-24" />,
        href: 'https://www.bitovi.com/',
        capabilities: [
          'Staff Augmentation',
          'Upgrades & Migrations',
          'Architectural Strategy',
          'Nx Workshops',
          'React',
          'Angular',
        ],
      },
      {
        name: 'Push Based',
        logo: <PushBasedIcon aria-hidden="true" className="mb-4 h-12" />,
        href: 'https://push-based.io/',
        capabilities: [
          'Upgrades & Migrations',
          'Architectural Strategy',
          'Angular',
        ],
      },
      {
        name: 'Callstack',
        logo: <CallstackIcon aria-hidden="true" className="mb-4 h-12" />,
        href: 'https://callstack.com/',
        capabilities: ['React'],
      },
      {
        name: 'E-Square',
        logo: <ESquareIcon aria-hidden="true" className="mb-4 h-12 w-32" />,
        href: 'https://e-square.io/',
        capabilities: [
          'Angular',
          'Nx Workshops',
          'Architectural Strategy',
          'Upgrades & Migrations',
          'Staff Augmentation',
          'Short Term Engagements',
        ],
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

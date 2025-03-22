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
      },
      {
        name: 'HeroDevs',
        logo: <HeroDevsIcon aria-hidden="true" className="mb-4 h-12" />,
        href: 'https://www.herodevs.com/',
      },
      {
        name: 'Bitovi',
        logo: <BitoviIcon aria-hidden="true" className="mb-4 h-12 w-24" />,
        href: 'https://www.bitovi.com/',
      },
      {
        name: 'Push Based',
        logo: <PushBasedIcon aria-hidden="true" className="mb-4 h-12" />,
        href: 'https://push-based.io/',
      },
      {
        name: 'Callstack',
        logo: <CallstackIcon aria-hidden="true" className="mb-4 h-12" />,
        href: 'https://callstack.com/',
      },
      {
        name: 'E-Square',
        logo: <ESquareIcon aria-hidden="true" className="mb-4 h-12 w-32" />,
        href: 'https://e-square.io/',
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
      <div className="col-span-2 border-y border-slate-200 bg-slate-50 px-6 py-24 sm:py-32 md:col-span-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl text-center">
          <div className="mx-auto max-w-3xl">
            <SectionHeading
              as="h2"
              variant="subtitle"
              className=" text-slate-950 sm:text-3xl dark:text-white"
            >
              Meet Our Partners
            </SectionHeading>
            <SectionDescription as="p" className="my-6 text-left">
              We're proud to collaborate with a diverse group of companies and
              individuals from around the globe that have gone through our Nx
              Experts Certification. Whether you're looking for professional
              support, educational content, or even implementation specialists,
              our partners have you covered.
            </SectionDescription>
          </div>

          <div className="mt-16">
            <dl className="grid grid-cols-2 justify-between gap-4 md:grid-cols-3 lg:grid-cols-4">
              {partners.map((partner) => (
                <Partner key={partner.name} {...partner} />
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

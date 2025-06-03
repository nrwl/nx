import {
  BitoviIcon,
  CallstackIcon,
  ESquareIcon,
  HeroDevsIcon,
  PushBasedIcon,
  BriebugIcon,
  LiveLoveAppIcon,
  NStudioIcon,
} from '@nx/nx-dev/ui-icons';
import { useEffect, useMemo, useState } from 'react';
import { Partner } from './partner';

export function PartnersList(): JSX.Element {
  const initialPartners = useMemo(
    () => [
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
        tagline: 'Make Code Fast at Scale',
        capabilities: ['Monorepo Strategies', 'Performance', 'Training'],
      },
      {
        name: 'Callstack',
        logo: <CallstackIcon aria-hidden="true" className="mb-4 h-12" />,
        href: 'https://callstack.com/',
        location: 'EU',
        tagline:
          'Cross-platform apps with one codebase. Repack. Reassure. React Native CLI.',
        capabilities: ['React Native', 'React', 'Next.js', 'SwiftUI'],
      },
      {
        name: 'E-Square',
        logo: <ESquareIcon aria-hidden="true" className="mb-4 h-12 w-32" />,
        href: 'https://e-square.io/',
        location: 'EU',
        tagline: 'Developer Experts On Demand',
        capabilities: ['Angular', 'React', 'Node', 'Next.js'],
      },
      {
        name: 'Briebug',
        logo: <BriebugIcon aria-hidden="true" className="h-14" />,
        href: 'https://briebug.com/',
        location: 'US',
        tagline: 'Your Angular and Nx Experts.',
        capabilities: ['Angular', 'Ionic', 'NgRx'],
      },
      {
        name: 'LiveLoveApp',
        logo: <LiveLoveAppIcon aria-hidden="true" className="mb-4 h-12" />,
        href: 'https://liveloveapp.com/',
        location: 'US',
        tagline: 'Bring Data to Life on the Web',
        capabilities: ['AI', 'Ag Grid', 'Angular', 'React'],
      },
      {
        name: 'nStudio',
        logo: <NStudioIcon aria-hidden="true" className="mb-4 h-12" />,
        href: 'https://nstudio.io/',
        location: 'US',
        tagline: "Craftsmanship perfected 'n' ways for your goals.",
        capabilities: ['Typescript', 'Swift', 'Kotlin', 'NativeScript'],
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

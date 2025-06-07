import {
  CloudArrowDownIcon,
  CodeBracketIcon,
  FingerPrintIcon,
  IdentificationIcon,
  LinkSlashIcon,
  RectangleGroupIcon,
  ServerIcon,
  ServerStackIcon,
} from '@heroicons/react/24/outline';
import { SectionHeading } from '@nx/nx-dev-ui-common';
import Link from 'next/link';
import { ReactElement } from 'react';

const features = [
  {
    name: 'Trusted CI Writes',
    description:
      'By default, only artifacts produced by verified CI pipelines can enter the shared cache, making cache-poisoning attacks impossible.',
    icon: ServerIcon,
  },
  {
    name: 'Artifact Traceability',
    description:
      'Every build artifact is tied to the identity and permissions of the user or process that created it, ensuring full auditability.',
    icon: FingerPrintIcon,
  },
  {
    name: 'Automatic Invalidation',
    description:
      'Revoke a compromised token and instantly render all artifacts it produced unusable.',
    icon: LinkSlashIcon,
  },
  {
    name: 'Real-Time Access Control',
    description:
      'Provision, audit, and revoke developer and CI access on the fly—integrated with your identity provider for immediate effect.',
    icon: IdentificationIcon,
  },
];

export function EnhancedSecurity(): ReactElement {
  return (
    <section id="enterprise-grade-ci-security" className="scroll-mt-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading as="h2" variant="title" id="deep-understanding">
            Enterprise-grade CI Security
          </SectionHeading>
          <SectionHeading as="p" variant="subtitle" className="mt-6">
            Protect your codebase from artifact poisoning with
            infrastructure-first safeguards—ensuring compliance in regulated
            industries.
          </SectionHeading>
        </div>
        <dl className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:mt-20 md:grid-cols-2 lg:mt-24 lg:gap-12">
          {features.map((feature) => (
            <div key={feature.name} className="relative pl-9">
              <dt className="flex items-center gap-4 text-base font-semibold leading-7 text-slate-950 dark:text-white">
                <feature.icon
                  aria-hidden="true"
                  className="absolute left-1 top-1 size-5 shrink-0"
                />
                {feature.name}
              </dt>
              <dd className="mt-2 text-base leading-7">
                {feature.description}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-12 text-center">
          <Link
            href="/enterprise/security"
            title="Learn more about Nx Cloud security"
            prefetch={false}
            className="group mt-4 text-sm font-semibold leading-6 text-slate-950 dark:text-white"
          >
            See what we do to keep you secure{' '}
            <span
              aria-hidden="true"
              className="inline-block transition group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

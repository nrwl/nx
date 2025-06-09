'use client';
import {
  FingerPrintIcon,
  LinkSlashIcon,
  ServerIcon,
} from '@heroicons/react/24/outline';
import {
  SectionDescription,
  SectionHeading,
  Strong,
} from '@nx/nx-dev/ui-common';
import { ReactElement } from 'react';

export function CachePoisoningProtection(): ReactElement {
  return (
    <section
      id="cache-poisoning-protection-section"
      className="scroll-mt-24 overflow-hidden"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:gap-20 lg:grid-cols-2 lg:items-end">
          <div>
            <SectionHeading
              as="h2"
              variant="title"
              id="cache-poisoning-protection"
            >
              Cache Poisoning Protection, By Design
            </SectionHeading>
            <SectionHeading as="p" variant="subtitle" className="mt-6">
              Protect your main branch – and your customers – from compromised
              builds.
            </SectionHeading>

            <SectionDescription as="p" className="mt-6">
              Most teams lock down code merges, but leave their cache wide open.
              With other tools, attackers can overwrite artifacts on the main
              branch without secrets, without cache access, and without leaving
              a trace.
            </SectionDescription>
            <SectionDescription as="p" className="mt-6">
              In other systems, cache poisoning can silently alter frontend
              forms, backend APIs, or database access — and go undetected. With
              Nx Cloud, only trusted builds produce trusted artifacts.
            </SectionDescription>
          </div>
          <div>
            <SectionDescription as="p" className="mt-6">
              <Strong>
                Nx Cloud makes this kind of attack categorically impossible by
                implementing:
              </Strong>
            </SectionDescription>

            <ul className="mt-4 space-y-4 text-base leading-7">
              <li className="relative pl-9">
                <span className="inline font-semibold text-slate-950 dark:text-white">
                  <ServerIcon
                    aria-hidden="true"
                    className="absolute left-1 top-1 h-5 w-5"
                  />
                  Writes only from trusted CI branches{' '}
                </span>
                – By default, the cache artifacts are reused within each pull
                request. Only artifacts from trusted CI pipelines should enter
                the shared cache used by everyone. PR environments can't poison
                main.
              </li>
              <li className="relative pl-9">
                <span className="inline font-semibold text-slate-950 dark:text-white">
                  <FingerPrintIcon
                    aria-hidden="true"
                    className="absolute left-1 top-1 h-5 w-5"
                  />
                  Artifact traceability{' '}
                </span>
                – Artifacts are tied to the identity and permissions of the user
                or process that created them.
              </li>
              <li className="relative pl-9">
                <span className="inline font-semibold text-slate-950 dark:text-white">
                  <LinkSlashIcon
                    aria-hidden="true"
                    className="absolute left-1 top-1 h-5 w-5"
                  />
                  Automatic invalidation{' '}
                </span>
                – Revoke a token and every artifact it produced becomes
                unusable.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

'use client';
import {
  FingerPrintIcon,
  IdentificationIcon,
  LinkSlashIcon,
} from '@heroicons/react/24/outline';
import {
  SectionDescription,
  SectionHeading,
  Strong,
} from '@nx/nx-dev/ui-common';
import { ReactElement } from 'react';
import { GitHubIcon } from '@nx/nx-dev/ui-icons';
import Link from 'next/link';

export function PersonalAccess(): ReactElement {
  return (
    <section
      id="control-access-in-real-time-section"
      className="scroll-mt-24 overflow-hidden"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:gap-20 lg:grid-cols-2 lg:items-start">
          <div>
            <SectionHeading
              as="h2"
              variant="title"
              id="control-access-in-real-time"
            >
              Personal Access: Control Access in Real Time
            </SectionHeading>
            <SectionHeading as="p" variant="subtitle" className="mt-6">
              Provision, audit, and revoke with confidence.
            </SectionHeading>

            <SectionDescription as="p" className="mt-6">
              Easily manage developer access to your Nx Cloud workspace — no
              waiting, no lingering access for former teammates or contractors.
            </SectionDescription>
          </div>

          <div>
            <SectionDescription as="p" className="mt-6">
              <Strong>Nx Cloud ensures:</Strong>
            </SectionDescription>

            <ul className="mt-4 space-y-4 text-base leading-7">
              <li className="relative pl-9">
                <span className="inline font-semibold text-slate-950 dark:text-white">
                  <IdentificationIcon
                    aria-hidden="true"
                    className="absolute left-1 top-1 h-5 w-5"
                  />
                  Access is tied to individual user authentication
                </span>
              </li>
              <li className="relative pl-9">
                <span className="inline font-semibold text-slate-950 dark:text-white">
                  <LinkSlashIcon
                    aria-hidden="true"
                    className="absolute left-1 top-1 h-5 w-5"
                  />
                  Token revocation cuts off access in real time
                </span>
                , and invalidates any artifacts they produced.
              </li>
            </ul>

            <div className="mt-4">
              <Link
                href="/ci/recipes/security/personal-access-tokens"
                title="Learn more about Personal Access Tokens"
                className="text-sm/6 font-semibold"
              >
                Learn more about Personal Access Tokens{' '}
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

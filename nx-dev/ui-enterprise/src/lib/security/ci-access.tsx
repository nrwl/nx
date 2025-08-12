'use client';
import {
  ArrowPathIcon,
  ArrowsUpDownIcon,
  FingerPrintIcon,
  IdentificationIcon,
  LinkSlashIcon,
} from '@heroicons/react/24/outline';
import {
  SectionDescription,
  SectionHeading,
  Strong,
} from '@nx/nx-dev-ui-common';
import { ReactElement } from 'react';
import { GitHubIcon } from '@nx/nx-dev-ui-icons';
import Link from 'next/link';

export function CiAccess(): ReactElement {
  return (
    <section
      id="token-rotation-and-revocation-section"
      className="scroll-mt-24 overflow-hidden"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:gap-20 lg:grid-cols-2 lg:items-end">
          <div>
            <SectionHeading
              as="h2"
              variant="title"
              id="token-rotation-and-revocation"
            >
              CI Access: Token Rotation & Revocation
            </SectionHeading>
            <SectionHeading as="p" variant="subtitle" className="mt-6">
              Secure today, safer tomorrow: automatic token rotation.
            </SectionHeading>

            <SectionDescription as="p" className="mt-6">
              <Strong>
                Compromised token? Those artifacts won’t touch production.
              </Strong>{' '}
              All artifacts created with a revoked token are automatically
              invalidated — so leaked credentials can’t poison your builds.
            </SectionDescription>
          </div>
          <div>
            <SectionDescription as="p" className="mt-6">
              <Strong>Nx Cloud allows you to:</Strong>
            </SectionDescription>
            <ul className="mt-4 space-y-4 text-base leading-7">
              <li className="relative pl-9">
                <span className="inline font-semibold text-slate-950 dark:text-white">
                  <ArrowPathIcon
                    aria-hidden="true"
                    className="absolute left-1 top-1 h-5 w-5"
                  />
                  Rotate tokens as needed
                </span>
              </li>
              <li className="relative pl-9">
                <span className="inline font-semibold text-slate-950 dark:text-white">
                  <ArrowsUpDownIcon
                    aria-hidden="true"
                    className="absolute left-1 top-1 h-5 w-5"
                  />
                  Minimize long-term exposure with read-write token rotations
                </span>
              </li>
            </ul>

            <div className="mt-4">
              <Link
                href="/ci/recipes/security/access-tokens"
                title="Learn more about CI Access Tokens"
                className="text-sm/6 font-semibold"
              >
                Learn more about CI Access Tokens{' '}
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

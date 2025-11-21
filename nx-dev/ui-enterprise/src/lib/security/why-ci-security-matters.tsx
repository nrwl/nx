'use client';
import {
  BugAntIcon,
  DocumentCheckIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import {
  ButtonLink,
  SectionDescription,
  SectionHeading,
  Strong,
} from '@nx/nx-dev-ui-common';
import { ReactElement } from 'react';

export function WhyCiSecurityMatters(): ReactElement {
  return (
    <section
      id="why-ci-security-matters-section"
      className="scroll-mt-24 overflow-hidden"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:gap-20 lg:grid-cols-2 lg:items-end">
          <div>
            <SectionHeading
              as="h2"
              variant="title"
              id="why-ci-security-matters"
            >
              Why CI Security Matters
            </SectionHeading>
            <SectionHeading as="p" variant="subtitle" className="mt-6">
              CI pipelines are often an overlooked threat — and your cache is a
              critical entry point.
            </SectionHeading>

            <SectionDescription as="p" className="mt-6">
              Modern build pipelines involve many contributors and moving parts.
              As your team evolves, it's essential to lock down access and
              prevent vulnerabilities like cache poisoning or unauthorized reuse
              of build data.
            </SectionDescription>
            <div className="mt-10 text-center">
              <ButtonLink
                href="/enterprise"
                variant="primary"
                size="default"
                title="Learn about Nx Cloud for Enterprises"
              >
                Learn about Nx Cloud for Enterprises
              </ButtonLink>
            </div>
          </div>
          <div>
            <ul className="mt-12 space-y-4 text-base leading-7">
              <li className="relative pl-9">
                <span className="inline font-semibold text-slate-950 dark:text-white">
                  <BugAntIcon
                    aria-hidden="true"
                    className="absolute left-1 top-1 h-5 w-5"
                  />
                  Build artifacts can be compromised and deployed{' '}
                </span>
                — if left unprotected
              </li>
              <li className="relative pl-9">
                <span className="inline font-semibold text-slate-950 dark:text-white">
                  <EyeSlashIcon
                    aria-hidden="true"
                    className="absolute left-1 top-1 h-5 w-5"
                  />
                  Revoked access must take effect immediately{' '}
                </span>
              </li>
              <li className="relative pl-9">
                <span className="inline font-semibold text-slate-950 dark:text-white">
                  <DocumentCheckIcon
                    aria-hidden="true"
                    className="absolute left-1 top-1 h-5 w-5"
                  />
                  Self-hosted caching can't guarantee artifact integrity.{' '}
                </span>
                Without strict branch isolation, access control, and rebuild
                policies, poisoned artifacts can silently reach production.{' '}
                <Strong>
                  For teams in highly regulated industries where undetected
                  modifications are unacceptable, the risk is too high.
                </Strong>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

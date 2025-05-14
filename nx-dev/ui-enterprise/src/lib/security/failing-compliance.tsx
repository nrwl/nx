'use client';
import {
  BugAntIcon,
  DocumentCheckIcon,
  ExclamationTriangleIcon,
  EyeSlashIcon,
  FingerPrintIcon,
  LinkSlashIcon,
  ServerIcon,
} from '@heroicons/react/24/outline';
import {
  ButtonLink,
  SectionDescription,
  SectionHeading,
  Strong,
} from '@nx/nx-dev/ui-common';
import { ReactElement } from 'react';
import Link from 'next/link';

export function FailingCompliance(): ReactElement {
  return (
    <section id="compliance-section" className="scroll-mt-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:gap-20 lg:grid-cols-2 lg:items-end">
          <div>
            <SectionHeading as="h2" variant="title" id="compliance">
              Rolling Your Own Cache Fails in Regulated Sectors
            </SectionHeading>
            <SectionHeading as="p" variant="subtitle" className="mt-6">
              Unmanaged caching may be convenient now—but it’s a liability down
              the road.
            </SectionHeading>

            <SectionDescription as="p" className="mt-6">
              If you operate in a regulated sector—
              <Strong>
                finance, healthcare, government, defense, aerospace, or
                pharmaceuticals
              </Strong>
              —self-hosting your remote cache may expose you to{' '}
              <Strong>serious risks like cache poisoning</Strong>.
            </SectionDescription>

            <SectionDescription as="p" className="mt-6">
              Community-built cache solutions reading and writing directly from
              the file storage are vulnerable to the Cache Poisoning by
              Construction attack resulting in any contributor with pull request
              privileges being able to potentially inject compromised artifacts
              into production environments without detection.{' '}
              <Strong>
                This vulnerability completely circumvents conventional security
                protections like encryption, access control and key management
              </Strong>
              .
            </SectionDescription>

            <SectionDescription as="p" className="mt-6">
              Even our official Nx self-hosted plugins adds enhanced security
              but follows a similar architecture. They are unable to make
              guarantees about how cache artifacts are secured or accessed and
              cannot meet the security demands of regulated industries.
            </SectionDescription>
          </div>
          <div>
            <SectionDescription as="p" className="mt-6">
              <Strong>
                Failing to secure your cache can lead to steep breach fines, SLA
                breaches, damaged reputation, and costly audit delays.
              </Strong>
            </SectionDescription>

            <ul className="mt-6 space-y-4 text-base leading-7">
              <li className="relative pl-9">
                <span className="inline font-semibold text-slate-950 dark:text-white">
                  <ExclamationTriangleIcon
                    aria-hidden="true"
                    className="absolute left-1 top-1 h-5 w-5"
                  />
                  SOC 2:{' '}
                </span>
                Self-hosted caches lack independent audits, continuous
                monitoring, and incident response documentation required for SOC
                2 compliance.
              </li>
              <li className="relative pl-9">
                <span className="inline font-semibold text-slate-950 dark:text-white">
                  <ExclamationTriangleIcon
                    aria-hidden="true"
                    className="absolute left-1 top-1 h-5 w-5"
                  />
                  HIPAA:{' '}
                </span>
                No administrative, physical, or technical safeguards to meet
                HIPAA mandates for protecting ePHI.
              </li>
              <li className="relative pl-9">
                <span className="inline font-semibold text-slate-950 dark:text-white">
                  <ExclamationTriangleIcon
                    aria-hidden="true"
                    className="absolute left-1 top-1 h-5 w-5"
                  />
                  ISO 27001:{' '}
                </span>
                Cannot prove a certified ISMS, risk-management processes, or
                internal/external audit cycles.
              </li>
              <li className="relative pl-9">
                <span className="inline font-semibold text-slate-950 dark:text-white">
                  <ExclamationTriangleIcon
                    aria-hidden="true"
                    className="absolute left-1 top-1 h-5 w-5"
                  />
                  FedRAMP:{' '}
                </span>
                Not authorized for federal use; missing mandatory controls for
                data classification, monitoring, and secure U.S. hosting.
              </li>
              <li className="relative pl-9">
                <span className="inline font-semibold text-slate-950 dark:text-white">
                  <ExclamationTriangleIcon
                    aria-hidden="true"
                    className="absolute left-1 top-1 h-5 w-5"
                  />
                  PCI-DSS:{' '}
                </span>
                No encryption, segmentation, or logging controls to safeguard
                cardholder data.
              </li>
            </ul>

            <div className="mt-10 text-center">
              <ButtonLink
                href="/contact/sales"
                variant="primary"
                size="default"
                title="Talk to an expert"
              >
                Talk to an expert
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

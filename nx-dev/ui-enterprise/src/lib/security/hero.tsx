'use client';
import { ButtonLink, SectionHeading, Strong } from '@nx/nx-dev/ui-common';
import { ReactElement, useState, useEffect } from 'react';
import { Dialog, DialogPanel, Transition } from '@headlessui/react';
import Link from 'next/link';

export function SecurityHero(): ReactElement {
  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center xl:max-w-6xl">
        <SectionHeading as="h1" variant="display">
          Enterprise-Grade Security, Built Into the Core
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6 text-center">
          Protect your codebase from artifact poisoning with
          infrastructure-first security.
        </SectionHeading>
      </div>
    </div>
  );
}

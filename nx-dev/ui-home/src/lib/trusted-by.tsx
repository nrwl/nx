import Link from 'next/link';
import { SectionDescription, SectionHeading } from '@nx/nx-dev/ui-common';
import {
  AwsIcon,
  BillIcon,
  CapitalOneIcon,
  CaterpillarIcon,
  CiscoIcon,
  EpicWebIcon,
  FicoIcon,
  HiltonIcon,
  ManIcon,
  RoyalBankOfCanadaIcon,
  ShopifyIcon,
  StorybookIcon,
  TanstackIcon,
  TypescriptEslintIcon,
  VmwareIcon,
  WalmartIcon,
} from '@nx/nx-dev/ui-icons';

export function TrustedBy(): JSX.Element {
  return (
    <article className="mx-auto max-w-7xl px-6 lg:px-8">
      <div className="text-center">
        <SectionHeading
          as="h2"
          variant="subtitle"
          id="trusted"
          className="scroll-mt-24 font-medium tracking-tight text-slate-950 sm:text-3xl dark:text-white"
        >
          Trusted by leading OSS projects and Fortune 500 companies.
        </SectionHeading>
        <SectionDescription as="p" className="mt-2">
          We developed Nx to be modular and incrementally adoptable to meet you
          where you’re at.
        </SectionDescription>
      </div>

      <div className="relative mt-12">
        <div className="grid grid-cols-3 place-items-center items-center gap-6 transition-all sm:grid-cols-4 md:grid-cols-8">
          <FicoIcon
            aria-hidden="true"
            className="h-24 w-24 text-slate-950 dark:text-white"
          />
          <RoyalBankOfCanadaIcon
            aria-hidden="true"
            className="h-10 w-10 text-slate-950 dark:text-white"
          />
          <CapitalOneIcon
            aria-hidden="true"
            className="h-28 w-28 text-slate-950 dark:text-white"
          />
          <TypescriptEslintIcon
            aria-hidden="true"
            className="h-10 w-10 text-slate-950 dark:text-white"
          />
          <CiscoIcon
            aria-hidden="true"
            className="h-16 w-16 text-slate-950 dark:text-white"
          />
          <StorybookIcon
            aria-hidden="true"
            className="h-10 w-10 text-slate-950 dark:text-white"
          />
          <BillIcon
            aria-hidden="true"
            className="hidden h-14 w-14 text-slate-950 sm:block dark:text-white"
          />
          <TanstackIcon
            aria-hidden="true"
            className="hidden h-10 w-10 text-slate-950 sm:block dark:text-white"
          />
          <ManIcon
            aria-hidden="true"
            className="hidden h-14 w-14 text-slate-950 md:block dark:text-white"
          />
          <HiltonIcon
            aria-hidden="true"
            className="hidden h-20 w-20 text-slate-950 md:block dark:text-white"
          />
          <CaterpillarIcon
            aria-hidden="true"
            className="hidden h-12 w-12 text-slate-950 md:block dark:text-white"
          />
          <EpicWebIcon
            aria-hidden="true"
            className="hidden h-10 w-10 text-slate-950 md:block dark:text-white"
          />
          <VmwareIcon
            aria-hidden="true"
            className="hidden h-28 w-28 text-slate-950 md:block dark:text-white"
          />
          <AwsIcon
            aria-hidden="true"
            className="hidden h-14 w-14 text-slate-950 md:block dark:text-white"
          />
          <WalmartIcon
            aria-hidden="true"
            className="hidden h-28 w-28 text-slate-950 md:block dark:text-white"
          />
          <ShopifyIcon
            aria-hidden="true"
            className="hidden h-10 w-10 text-slate-950 md:block dark:text-white"
          />
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/customers?utm_source=homepage&utm_medium=website&utm_campaign=homepage_links&utm_content=our_customers"
            title="Our customers"
            prefetch={false}
            className="group font-semibold leading-6 text-slate-950 transition-all duration-200 dark:text-white"
          >
            Learn about our customers{' '}
            <span
              aria-hidden="true"
              className="inline-block transition group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>
      </div>
    </article>
  );
}

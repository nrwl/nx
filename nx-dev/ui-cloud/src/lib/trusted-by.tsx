import {
  AwsAmplifyIcon,
  CapitalOneIcon,
  CiscoIcon,
  RedwoodJsIcon,
  RoyalBankOfCanadaIcon,
  ShopifyIcon,
  StorybookIcon,
  VmwareIcon,
} from '@nx/nx-dev/ui-common';
export function TrustedBy(): JSX.Element {
  return (
    <section className="">
      <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8 lg:pb-16">
        <h2 className="text-center text-lg font-medium leading-8 text-slate-400">
          Startups and Fortune 500 companies trust Nx Cloud
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-0.5 md:grid-cols-8">
          <div className="col-span-1 flex items-center justify-center">
            <RoyalBankOfCanadaIcon className="h-14 w-14 text-slate-300 dark:text-slate-600" />
          </div>
          <div className="col-span-1 flex items-center justify-center">
            <AwsAmplifyIcon className="h-14 w-14 text-slate-300 dark:text-slate-600" />
          </div>
          <div className="col-span-1 flex items-center justify-center">
            <CapitalOneIcon className="h-28 w-28 text-slate-300 dark:text-slate-600" />
          </div>
          <div className="col-span-1 flex items-center justify-center">
            <ShopifyIcon className="h-12 w-12 text-slate-300 dark:text-slate-600" />
          </div>
          <div className="col-span-1 flex items-center justify-center">
            <StorybookIcon className="h-12 w-12 text-slate-300 dark:text-slate-600" />
          </div>
          <div className="col-span-1 flex items-center justify-center ">
            <VmwareIcon className="h-28 w-28 text-slate-300 dark:text-slate-600" />
          </div>
          <div className="col-span-1 flex items-center justify-center">
            <RedwoodJsIcon className="h-12 w-12 text-slate-300 dark:text-slate-600" />
          </div>
          <div className="col-span-1 flex items-center justify-center">
            <CiscoIcon className="h-20 w-20 text-slate-300 dark:text-slate-600" />
          </div>
        </div>
      </div>
    </section>
  );
}

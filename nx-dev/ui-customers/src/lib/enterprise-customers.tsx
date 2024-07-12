import {
  ManIcon,
  VmwareIcon,
  SevenElevenIcon,
  AwsAmplifyIcon,
  CapitalOneIcon,
  ShopifyIcon,
  AmericanAirlinesIcon,
  CiscoIcon,
  CaterpillarIcon,
  FicoIcon,
  HiltonIcon,
  FedExIcon,
} from '@nx/nx-dev/ui-common';

export function EnterpriseCustomers(): JSX.Element {
  return (
    <section id="customers">
      <div className="mx-auto max-w-7xl text-center">
        <div className="mt-8">
          <div className="grid grid-cols-2 justify-between sm:grid-cols-3 lg:grid-cols-4">
            <a
              href="https://www.man-es.com/"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border border-slate-200/20 p-12 transition hover:bg-slate-100/20 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <ManIcon aria-hidden="true" className="h-20 w-20" />
            </a>
            <a
              href="https://www.caterpillar.com/"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-y border-slate-200/20 p-12 transition hover:bg-slate-100/20 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <CaterpillarIcon aria-hidden="true" className="h-16 w-16" />
            </a>
            <a
              href="https://www.capitalone.com/"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border border-slate-200/20 p-12 transition hover:bg-slate-100/20 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <CapitalOneIcon aria-hidden="true" className="h-32 w-32" />
            </a>
            <a
              href="https://www.vmware.com/"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-y border-r border-slate-200/20 p-12 transition hover:bg-slate-100/20 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <VmwareIcon aria-hidden="true" className="h-28 w-28" />
            </a>
            <a
              href="https://www.hilton.com/"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <HiltonIcon aria-hidden="true" className="h-24 w-24" />
            </a>
            <a
              href="https://www.myfico.com/"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <FicoIcon aria-hidden="true" className="h-28 w-28" />
            </a>
            <a
              href="https://www.7-eleven.com/"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <SevenElevenIcon aria-hidden="true" className="h-16 w-16" />
            </a>
            <a
              href="https://www.cisco.com/"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-r border-slate-200/20 p-12 transition hover:bg-slate-100/20 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <CiscoIcon aria-hidden="true" className="h-24 w-24" />
            </a>
            <a
              href="https://github.com/aws-amplify/amplify-cli"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <AwsAmplifyIcon aria-hidden="true" className="h-16 w-16" />
            </a>
            <a
              href="https://www.fedex.com/"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <FedExIcon aria-hidden="true" className="h-28 w-28" />
            </a>
            <a
              href="https://www.aa.com/"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <AmericanAirlinesIcon aria-hidden="true" className="h-12 w-12" />
            </a>
            <a
              href="https://github.com/Shopify/cli"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-r border-slate-200/20 p-12 transition hover:bg-slate-100/20 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <ShopifyIcon aria-hidden="true" className="h-12 w-12" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

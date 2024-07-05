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

const enterpriseCustomers = [
  {
    name: 'Payfit',
    logo: null,
    url: '',
  },
  {
    name: 'Threekit',
    logo: null,
    url: '',
  },
  {
    name: 'Paylocity',
    logo: null,
    url: '',
  },
  {
    name: 'Varian Medical',
    logo: null,
    url: '',
  },
  {
    name: 'Millenium',
    logo: null,
    url: 'https://www.mlp.com/',
  },
  {
    name: 'Flutter Entertainment',
    logo: null,
    url: 'https://www.flutter.com/',
  },
  {
    name: 'MAN Energy',
    logo: ManIcon,
    url: 'https://www.man-es.com/',
  },
  {
    name: 'Caterpillar',
    logo: CaterpillarIcon,
    url: 'https://www.caterpillar.com/',
  },
  {
    name: 'DNB',
    logo: null,
    url: 'https://www.dnb.no/',
  },
  {
    name: 'Swedbank',
    logo: null,
    url: '',
  },
  {
    name: 'Entain',
    logo: null,
    url: '',
  },
  {
    name: 'Capital One',
    logo: CapitalOneIcon,
    url: 'https://www.capitalone.com/',
  },
  {
    name: 'VMware',
    logo: VmwareIcon,
    url: 'https://www.vmware.com/',
  },
  {
    name: 'UKG',
    logo: null,
    url: 'https://www.ukg.com/',
  },
  {
    name: 'Danske Bank',
    logo: null,
    url: '',
  },
  {
    name: 'Tide',
    logo: null,
    url: 'https://www.tide.co/',
  },
  {
    name: 'Fidelity',
    logo: null,
    url: '',
  },
  {
    name: 'Hilton Hotels',
    logo: HiltonIcon,
    url: '',
  },
  {
    name: 'FICO',
    logo: FicoIcon,
    url: 'https://www.myfico.com/',
  },
  {
    name: '7-Eleven',
    logo: SevenElevenIcon,
    url: 'https://www.7-eleven.com/',
  },
  {
    name: 'MECCA',
    logo: null,
    url: '',
  },
  {
    name: 'Caseware',
    logo: null,
    url: '',
  },
  {
    name: "Dick's Sporting Goods",
    logo: null,
    url: '',
  },
  {
    name: 'Hetzner Cloud',
    logo: null,
    url: 'https://www.hetzner.com/',
  },
  {
    name: 'CAIS Group',
    logo: null,
    url: 'https://www.caisgroup.com/',
  },
  {
    name: 'Microsoft',
    logo: null,
    url: 'https://github.com/microsoft/fluentui',
  },
  {
    name: 'Cisco',
    logo: CiscoIcon,
    url: '',
  },
  {
    name: 'T-Mobile',
    logo: null,
    url: '',
  },
  {
    name: 'Amazon',
    logo: AwsAmplifyIcon,
    url: 'https://github.com/aws-amplify/amplify-cli',
  },
  {
    name: 'Hasura',
    logo: null,
    url: 'https://hasura.io/',
  },
  {
    name: 'Mailchimp',
    logo: null,
    url: 'https://mailchimp.com/it/',
  },
  {
    name: 'Philips',
    logo: null,
    url: 'https://www.philips.com',
  },
  {
    name: 'Vodafone',
    logo: null,
    url: '',
  },
  {
    name: 'Rabobank',
    logo: null,
    url: '',
  },
  {
    name: 'RedBull',
    logo: null,
    url: '',
  },
  {
    name: 'Adobe',
    logo: null,
    url: '',
  },
  {
    name: 'Adidas',
    logo: null,
    url: '',
  },
  {
    name: 'Paramount',
    logo: null,
    url: '',
  },
  {
    name: 'ClickUp',
    logo: null,
    url: '',
  },
  {
    name: 'Bloomberg',
    logo: null,
    url: '',
  },
  {
    name: 'Deloitte',
    logo: null,
    url: '',
  },
  {
    name: 'Ikea',
    logo: null,
    url: '',
  },
  {
    name: 'Intel',
    logo: null,
    url: '',
  },
  {
    name: 'ING',
    logo: null,
    url: '',
  },
  {
    name: 'Lego',
    logo: null,
    url: '',
  },
  {
    name: 'Moderna',
    logo: null,
    url: '',
  },
  {
    name: 'Sainsbury',
    logo: null,
    url: '',
  },
  {
    name: 'Splice',
    logo: null,
    url: '',
  },
  {
    name: 'Sharp',
    logo: null,
    url: '',
  },
  {
    name: 'FedEx',
    logo: FedExIcon,
    url: 'https://www.fedex.com/',
  },
  {
    name: 'American Airlines',
    logo: AmericanAirlinesIcon,
    url: 'https://www.aa.com/',
  },
  {
    name: 'Shopify',
    logo: ShopifyIcon,
    url: 'https://github.com/Shopify/cli',
  },
  {
    name: 'Ghost',
    logo: null,
    url: 'https://github.com/TryGhost/Ghost',
  },
];

export function EnterpriseCustomers(): JSX.Element {
  return (
    <section>
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

import { SectionHeading } from './section-tags';
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
} from '@nx/nx-dev/ui-common';

const enterpriseCustomers = [
  {
    name: 'Payfit',
    logo: null,
  },
  {
    name: 'Threekit',
    logo: null,
  },
  {
    name: 'Paylocity',
    logo: null,
  },
  {
    name: 'Varian Medical',
    logo: null,
  },
  {
    name: 'Millenium',
    logo: null,
  },
  {
    name: 'Flutter Entertainment',
    logo: null,
  },
  {
    name: 'MAN Energy',
    logo: ManIcon,
  },
  {
    name: 'Caterpillar',
    logo: CaterpillarIcon,
  },
  {
    name: 'DNB',
    logo: null,
  },
  {
    name: 'Swedbank',
    logo: null,
  },
  {
    name: 'Entain',
    logo: null,
  },
  {
    name: 'Capital One',
    logo: CapitalOneIcon,
  },
  {
    name: 'VMware',
    logo: VmwareIcon,
  },
  {
    name: 'UKG',
    logo: null,
  },
  {
    name: 'Danske Bank',
    logo: null,
  },
  {
    name: 'Tide',
    logo: null,
  },
  {
    name: 'Fidelity',
    logo: null,
  },
  {
    name: 'Hilton Hotels',
    logo: HiltonIcon,
  },
  {
    name: 'FICO',
    logo: FicoIcon,
  },
  {
    name: '7-Eleven',
    logo: SevenElevenIcon,
  },
  {
    name: 'MECCA',
    logo: null,
  },
  {
    name: 'Caseware',
    logo: null,
  },
  {
    name: "Dick's Sporting Goods",
    logo: null,
  },
  {
    name: 'Hetzner Cloud',
    logo: null,
  },
  {
    name: 'CAIS Group',
    logo: null,
  },
  {
    name: 'Microsoft',
    logo: null,
  },
  {
    name: 'Cisco',
    logo: CiscoIcon,
  },
  {
    name: 'T-Mobile',
    logo: null,
  },
  {
    name: 'Amazon',
    logo: AwsAmplifyIcon,
  },
  {
    name: 'Hasura',
    logo: null,
  },
  {
    name: 'Mailchimp',
    logo: null,
  },
  {
    name: 'Philips',
    logo: null,
  },
  {
    name: 'Vodafone',
    logo: null,
  },
  {
    name: 'Rabobank',
    logo: null,
  },
  {
    name: 'RedBull',
    logo: null,
  },
  {
    name: 'Adobe',
    logo: null,
  },
  {
    name: 'Adidas',
    logo: null,
  },
  {
    name: 'Paramount',
    logo: null,
  },
  {
    name: 'ClickUp',
    logo: null,
  },
  {
    name: 'Bloomberg',
    logo: null,
  },
  {
    name: 'Deloitte',
    logo: null,
  },
  {
    name: 'Ikea',
    logo: null,
  },
  {
    name: 'Intel',
    logo: null,
  },
  {
    name: 'ING',
    logo: null,
  },
  {
    name: 'Lego',
    logo: null,
  },
  {
    name: 'Moderna',
    logo: null,
  },
  {
    name: 'Sainsbury',
    logo: null,
  },
  {
    name: 'Splice',
    logo: null,
  },
  {
    name: 'Sharp',
    logo: null,
  },
  {
    name: 'FedEx',
    logo: null,
  },
  {
    name: 'American Airlines',
    logo: AmericanAirlinesIcon,
  },
  {
    name: 'Shopify',
    logo: ShopifyIcon,
  },
  {
    name: 'Ghost',
    logo: null,
  },
];

export function EnterpriseCustomers(): JSX.Element {
  return (
    <section>
      <div className="group relative isolate pb-24 pt-16">
        <svg
          className="absolute inset-0 -z-10 h-full w-full rotate-180 transform stroke-slate-100 transition [mask-image:radial-gradient(100%_100%_at_top,white,transparent)] group-hover:stroke-slate-200/70 dark:stroke-slate-800/60 dark:[mask-image:radial-gradient(100%_100%_at_top,black,transparent)] dark:group-hover:stroke-slate-800/90"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="83dwp7e5a-9d52-45fc-17c6-718e5d7fe918"
              width={200}
              height={200}
              x="50%"
              y={-1}
              patternUnits="userSpaceOnUse"
            >
              <path d="M100 200V.5M.5 .5H200" fill="none" />
            </pattern>
          </defs>
          <svg
            x="50%"
            y={-1}
            className="overflow-visible fill-slate-50/15 dark:fill-slate-900/10"
          >
            <path
              d="M-100.5 0h201v201h-201Z M699.5 0h201v201h-201Z M499.5 400h201v201h-201Z M-300.5 600h201v201h-201Z"
              strokeWidth={0}
            />
          </svg>
          <rect
            width="100%"
            height="100%"
            strokeWidth={0}
            fill="url(#83dwp7e5a-9d52-45fc-17c6-718e5d7fe918)"
          />
        </svg>
        <div className="mx-auto max-w-7xl text-center">
          <SectionHeading as="h2" variant="subtitle">
            Fortune 500 companies
          </SectionHeading>
          <div className="mt-20">
            <div className="grid grid-cols-2 justify-between gap-6 sm:grid-cols-3 lg:grid-cols-5">
              {enterpriseCustomers.map(
                (customer) =>
                  customer.logo && (
                    <div
                      key={customer.name}
                      className="flex items-center justify-center"
                    >
                      <customer.logo aria-hidden="true" className="h-20 w-20" />
                    </div>
                  )
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

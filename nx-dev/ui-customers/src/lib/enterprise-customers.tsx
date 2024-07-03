import Link from 'next/link';
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
    url: '',
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
    url: '',
  },
  {
    name: 'VMware',
    logo: VmwareIcon,
    url: '',
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
    url: '',
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
    logo: null,
    url: '',
  },
  {
    name: 'American Airlines',
    logo: AmericanAirlinesIcon,
    url: '',
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
                    <Link
                      href={customer.url}
                      key={customer.name}
                      target="_blank"
                      className="flex items-center justify-center"
                    >
                      <customer.logo aria-hidden="true" className="h-20 w-20" />
                    </Link>
                  )
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

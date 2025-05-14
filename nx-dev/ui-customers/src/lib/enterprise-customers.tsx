import {
  AdidasIcon,
  AdobeIcon,
  AmericanAirlinesIcon,
  BillIcon,
  BloombergIcon,
  CaisGroupIcon,
  CapitalOneIcon,
  CaterpillarIcon,
  CiscoIcon,
  ClickUpIcon,
  DeloitteIcon,
  DnbIcon,
  EntainIcon,
  FedExIcon,
  FicoIcon,
  HasuraIcon,
  HiltonIcon,
  IkeaIcon,
  IntelIcon,
  LegoIcon,
  MailChimpIcon,
  ManIcon,
  MillienniumIcon,
  ModernaIcon,
  ParamountIcon,
  PaylocityIcon,
  PhilipsIcon,
  PlexIcon,
  RedBullIcon,
  RoyalBankOfCanadaIcon,
  SainsburysIcon,
  SevenElevenIcon,
  SharpIcon,
  SpliceIcon,
  ThreeKitIcon,
  TideIcon,
  TMobileIcon,
  VarianIcon,
  VodafoneIcon,
  ZipariIcon,
} from '@nx/nx-dev/ui-icons';
import { DownloadCaseStudy } from '@nx/nx-dev/ui-enterprise';
import { CustomerTestimonialCarousel } from './customer-testimonial-carousel';
import { type CustomerIcon, CustomerIconGrid } from './customer-icon-grid';
import { type ReactElement } from 'react';

const firstCustomerIcons: CustomerIcon[] = [
  { url: 'https://man-es.com', icon: ManIcon, height: 'h-20', width: 'w-20' },
  {
    url: 'https://caterpillar.com',
    icon: CaterpillarIcon,
    height: 'h-16',
    width: 'w-16',
  },
  {
    url: 'https://capitalone.com',
    icon: CapitalOneIcon,
    height: 'h-32',
    width: 'w-32',
  },
  {
    url: 'https://hilton.com',
    icon: HiltonIcon,
    height: 'h-24',
    width: 'w-24',
  },
  { url: 'https://myfico.com', icon: FicoIcon, height: 'h-28', width: 'w-28' },
  {
    url: 'https://7-eleven.com',
    icon: SevenElevenIcon,
    height: 'h-16',
    width: 'w-16',
  },
  { url: 'https://cisco.com', icon: CiscoIcon, height: 'h-24', width: 'w-24' },
  {
    url: 'https://zipari.com',
    icon: ZipariIcon,
    height: 'h-12',
    width: 'w-12',
  },
];

const secondCustomerIcons: CustomerIcon[] = [
  {
    url: 'https://www.fedex.com',
    icon: FedExIcon,
    height: 'h-28',
    width: 'w-28',
  },
  {
    url: 'https://www.aa.com',
    icon: AmericanAirlinesIcon,
    height: 'h-12',
    width: 'w-12',
  },
  {
    url: 'https://www.bill.com',
    icon: BillIcon,
    height: 'h-16',
    width: 'w-16',
  },
  {
    url: 'https://www.adobe.com',
    icon: AdobeIcon,
    height: 'h-14',
    width: 'w-14',
  },
  {
    url: 'https://www.intel.com',
    icon: IntelIcon,
    height: 'h-16',
    width: 'w-16',
  },
  {
    url: 'https://www.adidas.com',
    icon: AdidasIcon,
    height: 'h-14',
    width: 'w-14',
  },
  {
    url: 'https://www.ikea.com',
    icon: IkeaIcon,
    height: 'h-20',
    width: 'w-20',
  },
  {
    url: 'https://www.deloitte.com',
    icon: DeloitteIcon,
    height: 'h-28',
    width: 'w-28',
  },
  {
    url: 'https://www.vodafone.com',
    icon: VodafoneIcon,
    height: 'h-12',
    width: 'w-12',
  },
  {
    url: 'https://mailchimp.com',
    icon: MailChimpIcon,
    height: 'h-14',
    width: 'w-14',
  },
  {
    url: 'https://www.modernatx.com',
    icon: ModernaIcon,
    height: 'h-32',
    width: 'w-32',
  },
  {
    url: 'https://www.paramountplus.com',
    icon: ParamountIcon,
    height: 'h-14',
    width: 'w-14',
  },
];

const thirdCustomerIcons: CustomerIcon[] = [
  {
    url: 'https://clickup.com',
    icon: ClickUpIcon,
    height: 'h-12',
    width: 'w-12',
  },
  {
    url: 'https://global.sharp',
    icon: SharpIcon,
    height: 'h-28',
    width: 'w-28',
  },
  {
    url: 'https://www.redbull.com',
    icon: RedBullIcon,
    height: 'h-24',
    width: 'w-24',
  },
  {
    url: 'https://www.lego.com',
    icon: LegoIcon,
    height: 'h-24',
    width: 'w-24',
  },
  {
    url: 'https://www.philips.ca',
    icon: PhilipsIcon,
    height: 'h-24',
    width: 'w-24',
  },
  {
    url: 'https://www.bloomberg.com',
    icon: BloombergIcon,
    height: 'h-10',
    width: 'w-10',
  },
  {
    url: 'https://www.sainsburys.co.uk',
    icon: SainsburysIcon,
    height: 'h-32',
    width: 'w-36',
  },
  {
    url: 'https://splice.com',
    icon: SpliceIcon,
    height: 'h-14',
    width: 'w-14',
  },
  { url: 'https://www.tide.co', icon: TideIcon, height: 'h-20', width: 'w-20' },
  { url: 'https://hasura.io', icon: HasuraIcon, height: 'h-12', width: 'w-12' },
  { url: ' https://www.dnb.no', icon: DnbIcon, height: 'h-16', width: 'w-16' },
  {
    url: 'https://ghost.org',
    icon: RoyalBankOfCanadaIcon,
    height: 'h-14',
    width: 'w-14',
  },
  {
    url: 'https://www.varian.com',
    icon: VarianIcon,
    height: 'h-28',
    width: 'w-28',
  },
  {
    url: 'https://www.paylocity.com',
    icon: PaylocityIcon,
    height: 'h-12',
    width: 'w-12',
  },
  {
    url: 'https://www.mlp.com',
    icon: MillienniumIcon,
    height: 'h-24',
    width: 'w-40',
  },
  {
    url: 'https://www.threekit.com',
    icon: ThreeKitIcon,
    height: 'h-12',
    width: 'w-12',
  },
  {
    url: 'https://www.caisgroup.com',
    icon: CaisGroupIcon,
    height: 'h-28',
    width: 'w-28',
  },
  {
    url: 'https://www.entaingroup.com',
    icon: EntainIcon,
    height: 'h-16',
    width: 'w-24',
  },
  {
    url: 'https://t-mobile.com',
    icon: TMobileIcon,
    height: 'h-10',
    width: 'w-10',
  },
  { url: 'https://plex.tv', icon: PlexIcon, height: 'h-20', width: 'w-20' },
];

export function EnterpriseCustomers(): ReactElement {
  return (
    <section id="customers">
      <div className="mt-8">
        <div className="mx-auto max-w-7xl">
          <CustomerIconGrid icons={firstCustomerIcons} />
        </div>

        <div className="col-span-2 border-y border-slate-200 bg-slate-50 py-24 sm:py-32 md:col-span-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto">
            <CustomerTestimonialCarousel />
          </div>
        </div>
        <div className="mx-auto max-w-7xl">
          <CustomerIconGrid icons={secondCustomerIcons} />

          <div className="grid-cols my-8 grid justify-center gap-8 px-2 py-6 md:grid-cols-3">
            <DownloadCaseStudy
              title="Financial Institution Case Study"
              description="$28B Fortune 500 financial institution reduces CI times by 79% with Nx Cloud."
              buttonHref="https://go.nx.dev/financial-case-study"
              buttonText="Read more"
              variant="secondary"
            />
            <DownloadCaseStudy
              title="Banking Case Study"
              description="$7B European bank cuts CI times by 62% and boosts team productivity."
              buttonHref="https://go.nx.dev/banking-case-study"
              buttonText="Read more"
              variant="secondary"
            />

            {/* Blog Excerpt */}
            <DownloadCaseStudy
              title="Improve your architecture and CI speeds"
              description="Structure your monorepo the right way to save time, reduce costs, and maximize efficiency."
              buttonHref="/blog/improve-architecture-and-ci-times-with-projects"
              buttonText="Read more"
              buttonCTA="Read more"
              variant="secondary"
            />
          </div>
          <CustomerIconGrid icons={thirdCustomerIcons} />
        </div>
      </div>
    </section>
  );
}

import {
  AdidasIcon,
  AdobeIcon,
  AmericanAirlinesIcon,
  BillIcon,
  BloombergIcon,
  CaisGroupIcon,
  CapitalOneIcon,
  CasewareIcon,
  CaterpillarIcon,
  CiscoIcon,
  ClickUpIcon,
  DeloitteIcon,
  DnbIcon,
  EntainIcon,
  FedExIcon,
  FicoIcon,
  HasuraIcon,
  HetznerCloudIcon,
  HiltonIcon,
  IkeaIcon,
  IntelIcon,
  LegoIcon,
  MailChimpIcon,
  ManIcon,
  MillienniumIcon,
  ModernaIcon,
  ParamountIcon,
  PayfitIcon,
  PaylocityIcon,
  PhilipsIcon,
  RabobankIcon,
  RedBullIcon,
  RoyalBankOfCanadaIcon,
  SainsburysIcon,
  SevenElevenIcon,
  SharpIcon,
  SpliceIcon,
  ThreeKitIcon,
  TideIcon,
  TMobileIcon,
  UkgIcon,
  VarianIcon,
  VmwareIcon,
  VodafoneIcon,
  SiriusxmIcon,
  WalmartIcon,
  PlexIcon,
  ZipariIcon,
} from '@nx/nx-dev/ui-icons';
import { DownloadCaseStudy } from '@nx/nx-dev/ui-enterprise';
import { CustomerTestimonialCarousel } from './customer-testimonial-carousel';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { ButtonLink } from '@nx/nx-dev/ui-common';

export function EnterpriseCustomers(): JSX.Element {
  return (
    <section id="customers">
      <div className="mx-auto max-w-7xl">
        <div className="mt-8">
          <div className="grid grid-cols-2 justify-between px-4 md:grid-cols-4">
            <a
              href="https://www.man-es.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <ManIcon aria-hidden="true" className="h-20 w-20" />
            </a>
            <a
              href="https://www.caterpillar.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-y border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <CaterpillarIcon aria-hidden="true" className="h-16 w-16" />
            </a>
            <a
              href="https://www.capitalone.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <CapitalOneIcon aria-hidden="true" className="h-32 w-32" />
            </a>
            <a
              href="https://www.vmware.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-y border-r border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <VmwareIcon aria-hidden="true" className="h-28 w-28" />
            </a>
            <a
              href="https://www.hilton.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <HiltonIcon aria-hidden="true" className="h-24 w-24" />
            </a>
            <a
              href="https://www.myfico.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <FicoIcon aria-hidden="true" className="h-28 w-28" />
            </a>
            <a
              href="https://www.7-eleven.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <SevenElevenIcon aria-hidden="true" className="h-16 w-16" />
            </a>
            <a
              href="https://www.cisco.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-r border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <CiscoIcon aria-hidden="true" className="h-24 w-24" />
            </a>
            <div className="col-span-2 py-24 md:col-span-4">
              <CustomerTestimonialCarousel />
            </div>
            <a
              href="https://zipari.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <ZipariIcon aria-hidden="true" className="h-12 w-12" />
            </a>
            <a
              href="https://www.fedex.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-t border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <FedExIcon aria-hidden="true" className="h-28 w-28" />
            </a>
            <a
              href="https://www.aa.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 md:border-t dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <AmericanAirlinesIcon aria-hidden="true" className="h-12 w-12" />
            </a>
            <a
              href="https://www.rabobank.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-r border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 md:border-t dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <RabobankIcon aria-hidden="true" className="h-32 w-32" />
            </a>
            <a
              href="https://www.bill.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b  border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <BillIcon aria-hidden="true" className="h-16 w-16" />
            </a>
            <a
              href="https://www.adobe.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <AdobeIcon aria-hidden="true" className="h-14 w-14" />
            </a>
            <a
              href="https://www.intel.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <IntelIcon aria-hidden="true" className="h-16 w-16" />
            </a>
            <a
              href="https://www.adidas.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-r border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white dark:hover:text-white"
            >
              <AdidasIcon aria-hidden="true" className="h-14 w-14" />
            </a>
            <a
              href="https://www.ikea.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <IkeaIcon aria-hidden="true" className="h-20 w-20" />
            </a>
            <a
              href="https://www.deloitte.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <DeloitteIcon aria-hidden="true" className="h-28 w-28" />
            </a>
            <a
              href="https://www.vodafone.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <VodafoneIcon aria-hidden="true" className="h-12 w-12" />
            </a>
            <a
              href="https://www.siriusxm.com/"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-r border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <SiriusxmIcon aria-hidden="true" className="h-28 w-28" />
            </a>
            <div className="col-span-2 flex items-center justify-center p-6 md:col-span-4">
              <DownloadCaseStudy
                title="Financial Institution Case Study"
                description="$28B Fortune 500 financial institution reduces CI times by 79% with Nx Cloud."
                buttonHref="https://go.nx.dev/financial-case-study"
              />
            </div>
            <a
              href="https://mailchimp.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <MailChimpIcon aria-hidden="true" className="h-14 w-14" />
            </a>
            <a
              href="https://www.modernatx.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-t border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <ModernaIcon aria-hidden="true" className="h-32 w-32" />
            </a>
            <a
              href="https://clickup.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 md:border-t dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <ClickUpIcon aria-hidden="true" className="h-12 w-12" />
            </a>
            <a
              href="https://global.sharp"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-r border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 md:border-t dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <SharpIcon aria-hidden="true" className="h-28 w-28" />
            </a>
            <a
              href="https://www.redbull.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <RedBullIcon aria-hidden="true" className="h-24 w-24" />
            </a>
            <a
              href="https://www.lego.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <LegoIcon aria-hidden="true" className="h-24 w-24" />
            </a>
            <a
              href="https://www.philips.ca"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <PhilipsIcon aria-hidden="true" className="h-24 w-24" />
            </a>
            <a
              href="https://www.bloomberg.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-r border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <BloombergIcon aria-hidden="true" className="h-10 w-10" />
            </a>
            <a
              href="https://www.sainsburys.co.uk"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <SainsburysIcon aria-hidden="true" className="h-32 w-36" />
            </a>
            <a
              href="https://splice.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <SpliceIcon aria-hidden="true" className="h-14 w-14" />
            </a>
            <a
              href="https://www.tide.co"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <TideIcon aria-hidden="true" className="h-20 w-20" />
            </a>
            <a
              href="https://hasura.io"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-r border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <HasuraIcon aria-hidden="true" className="h-12 w-12" />
            </a>
            <div className="col-span-2 flex items-center justify-center p-6 md:col-span-4">
              <DownloadCaseStudy
                title="Banking Case Study"
                description="$7B European bank cuts CI times by 62% and boosts team productivity."
                buttonHref="https://go.nx.dev/banking-case-study"
              />
            </div>
            <a
              href="https://www.hetzner.com/cloud"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <HetznerCloudIcon aria-hidden="true" className="h-10 w-10" />
            </a>
            <a
              href=" https://www.dnb.no"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-t border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <DnbIcon aria-hidden="true" className="h-16 w-16" />
            </a>
            <a
              href="https://ghost.org"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 md:border-t dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <RoyalBankOfCanadaIcon aria-hidden="true" className="h-14 w-14" />
            </a>
            <a
              href="https://www.ukg.ca"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-r border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 md:border-t dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <UkgIcon aria-hidden="true" className="h-20 w-20" />
            </a>
            <a
              href="https://www.varian.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <VarianIcon aria-hidden="true" className="h-28 w-28" />
            </a>
            <a
              href="https://www.paylocity.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <PaylocityIcon aria-hidden="true" className="h-12 w-12" />
            </a>
            <a
              href="https://www.mlp.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <MillienniumIcon aria-hidden="true" className="h-24 w-40" />
            </a>
            <a
              href="https://payfit.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-r border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <PayfitIcon aria-hidden="true" className="h-14 w-14" />
            </a>
            <a
              href="https://www.threekit.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <ThreeKitIcon aria-hidden="true" className="h-12 w-12" />
            </a>
            <a
              href="https://www.caisgroup.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <CaisGroupIcon aria-hidden="true" className="h-28 w-28" />
            </a>
            <a
              href="https://www.caseware.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <CasewareIcon aria-hidden="true" className="h-12 w-12" />
            </a>
            <a
              href="https://www.entaingroup.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-r border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <EntainIcon aria-hidden="true" className="h-16 w-24" />
            </a>
            {/* Blog Excerpt */}
            <div className="col-span-2 flex items-center justify-center p-6 md:col-span-4">
              <div className="border border-slate-100 bg-white shadow-lg sm:rounded-lg dark:border-slate-800/60 dark:bg-slate-950">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-base font-semibold leading-6 text-slate-900 dark:text-slate-100">
                    Improve your architecture and CI pipeline times
                  </h3>
                  <div className="mt-2 sm:flex sm:items-start sm:justify-between">
                    <div className="max-w-xl text-sm">
                      <p>
                        Discover how to structure your monorepo the right way to
                        save time, reduce costs, and maximize efficiency
                      </p>
                    </div>
                    <div className="mt-5 sm:ml-6 sm:mt-0 sm:flex sm:flex-shrink-0 sm:items-center">
                      <ButtonLink
                        href="/blog/improve-architecture-and-ci-times-with-projects"
                        title={`Download`}
                        variant="secondary"
                        size="small"
                      >
                        Read More <ChevronRightIcon className="h-4 w-4" />
                      </ButtonLink>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <a
              href="https://www.t-mobile.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <TMobileIcon aria-hidden="true" className="h-10 w-10" />
            </a>
            <a
              href="https://www.plexapp.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <PlexIcon aria-hidden="true" className="h-20 w-20" />
            </a>
            <a
              href="https://www.paramountplus.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-x border-b border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <ParamountIcon aria-hidden="true" className="h-14 w-14" />
            </a>
            <a
              href="https://www.walmart.com"
              rel="noreferrer"
              target="_blank"
              className="flex items-center justify-center border-b border-r border-slate-200/20 p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white"
            >
              <WalmartIcon aria-hidden="true" className="h-28 w-28" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

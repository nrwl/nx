import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import {
  ButtonLink,
  Footer,
  Header,
  HubspotForm,
  SectionHeading,
} from '@nx/nx-dev/ui-common';
import {
  CapitalOneIcon,
  CaterpillarIcon,
  RoyalBankOfCanadaIcon,
  ShopifyIcon,
  SiriusxmAlternateIcon,
} from '@nx/nx-dev/ui-icons';
import { type ReactElement } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { sendCustomEvent } from '@nx/nx-dev/feature-analytics';

export function WhitePaperFastCI(): ReactElement {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Fast CI for Monorepos - Speed Up Development and Cut Costs"
        description="Download our in-depth whitepaper to discover strategies for reducing build times and boosting CI performance. Nx's enterprise-grade tools are built for large, fast-moving teams."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Fast CI for Monorepos - Speed Up Development and Cut Costs',
          description:
            "Download our in-depth whitepaper to discover strategies for reducing build times and boosting CI performance. Nx's enterprise-grade tools are built for large, fast-moving teams.",
          images: [
            {
              url: 'https://nx.dev/socials/nx-media.png',
              width: 800,
              height: 421,
              alt: 'Nx: Smart Repos · Fast Builds',
              type: 'image/jpeg',
            },
          ],
          siteName: 'Nx',
          type: 'website',
        }}
      />
      <Header />
      <main id="main" role="main" className="py-24 lg:py-32">
        <div>
          <section id="whitepaper-fast-ci">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <div className="mx-auto max-w-3xl text-center">
                <SectionHeading
                  as="h1"
                  variant="display"
                  id="enterprise-ci-reimagined"
                >
                  Enterprise CI, Reimagined
                </SectionHeading>
                <SectionHeading
                  as="p"
                  className="mt-6"
                  variant="subtitle"
                  id="enterprise-ci-reimagined"
                >
                  Up to 70% Faster Builds for Monorepos
                </SectionHeading>
              </div>
              <div className="mx-auto mt-16 flex max-w-5xl flex-col gap-12 md:flex-row lg:gap-8">
                <section className="flex-1">
                  <p className="text-lg leading-relaxed">
                    The world’s moving fast, and getting products to market
                    feels like a race that keeps speeding up. Monorepos are
                    transforming development by enhancing collaboration, code
                    reuse, and team velocity. But, CI that is not tailored for
                    monorepos can result in slow builds, operational complexity,
                    increased costs and test bottlenecks.
                  </p>

                  <div className="mt-12 text-center">
                    <SectionHeading as="p" variant="subtitle">
                      See how to get fast CI, built for monorepos
                    </SectionHeading>
                    <ButtonLink
                      href="/assets/enterprise/Fast-CI-Whitepaper.pdf"
                      title="Download the guide"
                      target="_blank"
                      variant="secondary"
                      size="small"
                      onClick={() =>
                        sendCustomEvent(
                          'download-ebook-click',
                          'whitepaper-fast-ci-hero',
                          'whitepaper-fast-ci'
                        )
                      }
                      className="mt-2"
                    >
                      <ArrowDownTrayIcon
                        aria-hidden="true"
                        className="size-5 shrink-0"
                      />
                      <span>Download the guide</span>
                    </ButtonLink>
                  </div>

                  <figure className="mt-16 rounded-lg bg-slate-100 p-4 pl-8 dark:bg-slate-800">
                    <blockquote className="text-base/7">
                      <p>
                        “The decision to jump to Nx Cloud was really something
                        we wanted from the beginning. There's nothing but
                        benefits from it. Nx means tooling and efficiency around
                        our software development lifecycle that empowers us to
                        move a lot faster, ship code faster and more reliably.”
                      </p>
                    </blockquote>
                    <figcaption className="mt-6 flex items-center gap-x-4 text-sm/6">
                      <img
                        alt="Justin Schwartzenberger"
                        src="https://avatars.githubusercontent.com/u/1243236?v=4"
                        className="size-8 flex-none rounded-full"
                      />
                      <div>
                        <div className="font-semibold">
                          Justin Schwartzenberger
                        </div>
                        <div className="text-slate-500">
                          Principal Software Engineer, SiriusXM
                        </div>
                      </div>
                      <SiriusxmAlternateIcon
                        aria-hidden="true"
                        className="ml-auto size-10 rounded text-[#0000EB] dark:bg-slate-200"
                      />
                    </figcaption>
                  </figure>
                  <div className="mt-12 grid w-full grid-cols-4 place-items-center gap-2">
                    <CapitalOneIcon
                      aria-hidden="true"
                      className="col-span-1 size-28  text-black dark:text-white"
                    />

                    <CaterpillarIcon
                      aria-hidden="true"
                      className="col-span-1 size-14  text-[#FFCD11]"
                    />

                    <RoyalBankOfCanadaIcon
                      aria-hidden="true"
                      className="col-span-1 size-14  text-black dark:text-white"
                    />

                    <ShopifyIcon
                      aria-hidden="true"
                      className="col-span-1 size-14 text-[#7AB55C]"
                    />
                  </div>
                </section>
                <section className="flex-1 rounded-xl border border-slate-200 bg-white p-8 md:self-start dark:border-slate-800/40">
                  <HubspotForm
                    region="na1"
                    portalId="2757427"
                    formId="11eff6d1-791d-454d-a7f8-117ee747bf2a"
                    noScript={true}
                    loading={<div>Loading...</div>}
                  />
                </section>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default WhitePaperFastCI;

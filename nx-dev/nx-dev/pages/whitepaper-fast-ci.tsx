import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import { Footer, Header } from '@nx/nx-dev/ui-common';
import { SectionHeading, HubspotForm } from '@nx/nx-dev/ui-common';
import {
  CapitalOneIcon,
  CaterpillarIcon,
  ManIcon,
  RedwoodJsIcon,
  RoyalBankOfCanadaIcon,
  ShopifyIcon,
  SiriusxmAlternateIcon,
  StorybookIcon,
  VmwareIcon,
} from '@nx/nx-dev/ui-icons';
import { type ReactElement } from 'react';

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
              alt: 'Nx: Smart Monorepos · Fast CI',
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
                <section className="mt-4 flex-1">
                  <p className="text-lg leading-relaxed">
                    The world’s moving fast, and getting products to market
                    feels like a race that keeps speeding up. Monorepos are
                    transforming development by enhancing collaboration, code
                    reuse, and team velocity. But, CI not tailored for monorepos
                    can result in delays and added costs. Make sure you’re
                    avoiding these common pitfalls.
                  </p>
                  <div className="mt-4">
                    <ol className="ml-4 list-inside list-decimal space-y-2">
                      <li>
                        {' '}
                        <span className="font-bold">Slow Build Times</span>
                        <p className="ml-4 mt-2">
                          As monorepos grow, builds and tests across multiple
                          projects take longer, bottlenecking even the most
                          high-performing teams.
                        </p>{' '}
                      </li>
                      <li>
                        <span className="font-bold">
                          Operational Complexity
                        </span>
                        <p className="ml-4 mt-2">
                          Managing CI pipelines for monorepos often requires
                          custom, static configurations that demand constant
                          tweaking – stealing focus from devs.
                        </p>
                      </li>
                      <li>
                        <span className="font-bold">Runaway Costs</span>
                        <p className="ml-4 mt-2">
                          Inefficient resource allocation means even small
                          changes can trigger significant compute costs, making
                          scaling expensive and unsustainable.
                        </p>
                      </li>
                      <li>
                        <span className="font-bold">Test Bottlenecks</span>
                        <p className="ml-4 mt-2">
                          End-to-end test flakiness and long runtimes delay
                          feedback cycles, frustrating teams and introducing
                          costly delays in deployment.
                        </p>
                      </li>
                    </ol>
                  </div>
                  <p className="mt-8 text-lg font-bold leading-relaxed">
                    Feeling the impact of these challenges?
                  </p>
                  <p className="text-lg leading-relaxed">
                    Check out our <span className="font-bold">whitepaper</span>{' '}
                    to see how Nx Cloud users get products to market faster. Or
                    reach out and we can talk through your team’s unique needs.
                  </p>

                  <div className="py-10">
                    <a
                      target="_blank"
                      className="mt-4 text-lg font-bold leading-relaxed underline"
                      href="/assets/enterprise/Fast-CI-Whitepaper.pdf"
                    >
                      View whitepaper
                    </a>
                  </div>

                  <figure className="mt-4 rounded-lg bg-slate-100 p-4 pl-8 dark:bg-slate-800">
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
                        className="ml-auto size-10 text-[#0000EB]"
                      />
                    </figcaption>
                  </figure>
                  <div className="mx-auto mt-12 grid w-full grid-cols-4 gap-2 md:grid-cols-2 lg:mt-12">
                    <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
                      <RoyalBankOfCanadaIcon
                        aria-hidden="true"
                        className="size-14 text-black dark:text-white"
                      />
                    </div>

                    <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
                      <ManIcon
                        aria-hidden="true"
                        className="size-14 text-[#E40045]"
                      />
                    </div>
                    <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
                      <ShopifyIcon
                        aria-hidden="true"
                        className="size-12 text-[#7AB55C]"
                      />
                    </div>
                    <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
                      <CapitalOneIcon
                        aria-hidden="true"
                        className="size-28 text-black dark:text-white"
                      />
                    </div>
                    <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
                      <VmwareIcon
                        aria-hidden="true"
                        className="size-28 text-black dark:text-white"
                      />
                    </div>
                    <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
                      <StorybookIcon
                        aria-hidden="true"
                        className="size-12 text-[#FF4785]"
                      />
                    </div>
                    <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
                      <RedwoodJsIcon
                        aria-hidden="true"
                        className="size-12 text-[#BF4722]"
                      />
                    </div>
                    <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
                      <CaterpillarIcon
                        aria-hidden="true"
                        className="size-14 text-[#FFCD11]"
                      />
                    </div>
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

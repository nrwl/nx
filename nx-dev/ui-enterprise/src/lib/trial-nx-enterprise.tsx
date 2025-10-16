import {
  ButtonLink,
  HubspotForm,
  SectionHeading,
  VideoPlayer,
  VideoPlayerButton,
  VideoPlayerModal,
  VideoPlayerOverlay,
  VideoPlayerProvider,
  VideoPlayerThumbnail,
} from '@nx/nx-dev-ui-common';
import { type ReactElement } from 'react';
import {
  CapitalOneIcon,
  CasewareIcon,
  CaterpillarIcon,
  RoyalBankOfCanadaIcon,
  ShopifyIcon,
} from '@nx/nx-dev-ui-icons';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { sendCustomEvent } from '@nx/nx-dev-feature-analytics';

export function TrialNxEnterprise(): ReactElement {
  return (
    <section id="enterprise-trial">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading as="h1" variant="display" id="trial-nx-enterprise">
            Discover Your <br />
            Nx Enterprise ROI
          </SectionHeading>
        </div>
        <div className="mx-auto mt-16 flex max-w-5xl flex-col gap-12 md:flex-row lg:gap-8">
          <section className="flex-1">
            <h3 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              Much more than a simple trial
            </h3>

            <p className="mt-8 text-lg leading-relaxed">
              An Nx Enterprise <span className="font-bold">Proof of Value</span>{' '}
              is your hands-on opportunity to boost CI & DX, realize Nx’s full
              value, and quantify your ROI. Let us guide you.
            </p>

            <div className="mt-12 text-center">
              <SectionHeading as="p" variant="subtitle">
                How a Proof of Value works?
              </SectionHeading>
              <ButtonLink
                href="/assets/enterprise/Nx-Enterprise-POV.pdf"
                title="Download the guide"
                target="_blank"
                variant="secondary"
                size="small"
                onClick={() =>
                  sendCustomEvent(
                    'download-ebook-click',
                    'enterprise-trial-hero',
                    'enterprise-trial'
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

            <div className="mt-16">
              <VideoPlayerProvider
                videoUrl="https://youtu.be/bO4l2HXA0vQ"
                analytics={{
                  event: 'nx-enterprise-what-to-expect-video-click',
                  category: 'nx-enterprise-what-to-expect',
                  label: 'contact-trial',
                }}
              >
                <VideoPlayer>
                  <VideoPlayerThumbnail
                    src="/images/enterprise/nx-enterprise-what-to-expect.avif"
                    alt="video still"
                    width={960}
                    height={540}
                  />
                  <VideoPlayerOverlay>
                    <VideoPlayerButton
                      variant="blue-pink"
                      text={{
                        primary: 'Watch the video',
                        secondary: 'Under 2 minutes.',
                      }}
                      size="sm"
                    />
                  </VideoPlayerOverlay>
                </VideoPlayer>
                <VideoPlayerModal />
              </VideoPlayerProvider>
            </div>
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
              formId="e7f05c82-b56c-4a31-8cf8-a53ca8d69c5b"
              calendlyFormId="fd9d9be5-55cd-4b49-874b-ee54deb141f1"
              loading={<div>Loading...</div>}
              noScript={true}
              portalId="2757427"
              region="na1"
            />
          </section>
        </div>
        <figure className="mx-auto mt-16 max-w-4xl rounded-lg bg-slate-100 p-4 pl-8 dark:bg-slate-800">
          <blockquote className="text-base/7">
            <p>
              “They asked me a few years ago, ‘Do you want to trial Nx
              Enterprise?’ and I said, ‘Sure, why not?’ It was actually pretty
              easy, and immediately the feedback was, ‘Wow, this is a huge time
              saver!’ Once it expired, it was an immediate, ‘Oh no, what are we
              going to do?’”
            </p>
          </blockquote>
          <figcaption className="mt-6 flex items-center gap-x-4 text-sm/6">
            <img
              alt="Amir Toole, VP of Engineering, Caseware"
              src="/images/customers/enterprise/amir-toole-caseware-headshot.avif"
              className="size-8 flex-none rounded-full"
            />
            <div>
              <div className="font-semibold">Amir Toole</div>
              <div className="text-slate-500">VP of Engineering, Caseware</div>
            </div>
            <CasewareIcon
              aria-hidden="true"
              className="ml-auto size-10 text-[#F56354]"
            />
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

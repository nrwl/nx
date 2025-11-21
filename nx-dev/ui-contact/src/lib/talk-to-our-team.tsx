import {
  SectionHeading,
  HubspotForm,
  VideoPlayerProvider,
  VideoPlayer,
  VideoPlayerThumbnail,
  VideoPlayerOverlay,
  VideoPlayerButton,
  VideoPlayerModal,
} from '@nx/nx-dev-ui-common';
import { type ReactElement } from 'react';
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
} from '@nx/nx-dev-ui-icons';

export function TalkToOurTeam(): ReactElement {
  return (
    <section id="contact-team">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading as="h1" variant="display" id="how-can-we-help">
            Talk to our team
          </SectionHeading>
        </div>
        <div className="mx-auto mt-16 flex max-w-5xl flex-col gap-12 md:flex-row lg:gap-8">
          <section className="flex-1">
            <p className="text-lg leading-relaxed">
              We help teams reduce build times, cut compute costs, and get to
              green PRs faster. Whether you're ready for a thorough evaluation
              of your CI workflow or just exploring what Nx can do, reach out
              to:
            </p>
            <div className="mt-4">
              <ul className="ml-4 list-inside list-disc space-y-2">
                <li>Learn about our products and solutions</li>
                <li>Demo our products firsthand and see the difference</li>
                <li>
                  Get a hands-on evaluation with measurable impact on your CI
                  metrics.
                </li>
              </ul>
            </div>
            <p className="mt-5 text-lg font-bold leading-relaxed">
              Let’s Talk!
            </p>
            <p className="text-lg leading-relaxed">
              Fill out the form to pick a time to speak with an Nx expert.
            </p>

            <div className="mt-12">
              <VideoPlayerProvider
                videoUrl="https://youtu.be/bO4l2HXA0vQ"
                analytics={{
                  event: 'nx-enterprise-what-to-expect-video-click',
                  category: 'nx-enterprise-what-to-expect',
                  label: 'contact',
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

            <figure className="mt-12 rounded-lg bg-slate-100 p-4 pl-8 dark:bg-slate-800">
              <blockquote className="text-base/7">
                <p>
                  “Nx means tooling and efficiency around our software
                  development lifecycle that empowers us to ship code faster and
                  more reliably.”
                </p>
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-x-4 text-sm/6">
                <img
                  alt="Justin Schwartzenberger"
                  src="https://avatars.githubusercontent.com/u/1243236?v=4"
                  className="size-8 flex-none rounded-full"
                />
                <div>
                  <div className="font-semibold">Justin Schwartzenberger</div>
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
          </section>
          <section className="w-full flex-1 rounded-xl border border-slate-200 bg-white p-8 md:self-start dark:border-slate-800/40">
            <HubspotForm
              calendlyFormId="436b5997-6d7f-4220-8726-0ac417eb8f54"
              formId="2e492124-843c-4a6d-87fe-93db27ab4323"
              loading={<div>Loading...</div>}
              noScript={true}
              portalId="2757427"
              region="na1"
            />
          </section>
        </div>
        <div className="mx-auto mt-12 grid w-full grid-cols-4 gap-2 md:grid-cols-8 lg:mt-12">
          <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
            <RoyalBankOfCanadaIcon
              aria-hidden="true"
              className="size-14 text-black dark:text-white"
            />
          </div>

          <div className="col-span-1 flex h-14 items-center justify-center lg:h-28">
            <ManIcon aria-hidden="true" className="size-14 text-[#E40045]" />
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
      </div>
    </section>
  );
}

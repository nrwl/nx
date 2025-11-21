import { ReactElement } from 'react';
import {
  ButtonLink,
  SectionHeading,
  VideoPlayer,
  VideoPlayerProvider,
  VideoPlayerThumbnail,
  VideoPlayerOverlay,
  VideoPlayerButton,
  VideoPlayerModal,
} from '@nx/nx-dev-ui-common';
import { sendCustomEvent } from '@nx/nx-dev-feature-analytics';
import { EnvelopeIcon } from '@heroicons/react/24/outline';
import { PayfitIcon } from '@nx/nx-dev-ui-icons';
import { WebinarSection } from '../../webinar-section';

export function SolutionsPlatformHero(): ReactElement {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl lg:flex">
        <div className="mx-auto max-w-3xl px-6 py-24 lg:mx-0 lg:shrink-0 lg:px-8">
          <WebinarSection />
          <SectionHeading
            id="get-speed-and-scale"
            as="h1"
            variant="display"
            className="mt-8 text-pretty tracking-tight"
          >
            CI that works out of the box –{' '}
            <span className="rounded-lg bg-gradient-to-r from-blue-500 to-sky-500 bg-clip-text text-transparent">
              stays reliable at scale
            </span>
          </SectionHeading>
          <SectionHeading
            as="p"
            variant="subtitle"
            className="mx-auto mt-6 max-w-3xl lg:pr-20"
          >
            Reliable, out-of-the-box CI that scales. Cut costs and boost speed
            with smart caching, compute distribution, and enhanced security for
            your pipelines.
          </SectionHeading>
          <div className="mt-8 flex items-center gap-x-3">
            <ButtonLink
              href="/contact/sales"
              title="Talk to our team"
              variant="primary"
              size="default"
              onClick={() =>
                sendCustomEvent(
                  'contact-sales-click',
                  'solutions-platform-hero',
                  'solutions-platform'
                )
              }
            >
              Talk to our team
            </ButtonLink>

            <ButtonLink
              href="https://go.nx.dev/nx-newsletter"
              title="Talk to the team"
              variant="secondary"
              size="default"
              onClick={() =>
                sendCustomEvent(
                  'subscribe-newsletter-click',
                  'solutions-platform-hero',
                  'solutions-platform'
                )
              }
            >
              <EnvelopeIcon aria-hidden="true" className="size-4" />
              <span>Subscribe to the newsletter</span>
            </ButtonLink>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <div>
            <VideoPlayerProvider
              videoUrl="https://youtu.be/Vdk-tza4PCs"
              analytics={{
                event: 'payfit-testimonial-video-click',
                category: 'payfit-testimonial-solutions',
                label: 'solutions',
              }}
            >
              <VideoPlayer>
                <VideoPlayerThumbnail
                  src="/images/customers/video-story-payfit.avif"
                  alt="video still"
                  width={960}
                  height={540}
                  className="relative rounded-xl"
                />
                <VideoPlayerOverlay>
                  <VideoPlayerButton
                    variant="blue-pink"
                    text={{
                      primary: 'Watch the interview',
                      secondary: 'Under 3 minutes.',
                    }}
                  />
                </VideoPlayerOverlay>
              </VideoPlayer>
              <VideoPlayerModal />
            </VideoPlayerProvider>
            <div className="mt-4 flex items-center gap-x-4 text-sm/6">
              <PayfitIcon
                aria-hidden="true"
                className="size-10 flex-none shrink-0 text-[#0F6FDE] dark:text-white"
              />
              <div>
                From 5 days to 2 hours: How Payfit improved velocity and
                offloads complexity with Nx.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

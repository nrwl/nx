import { ReactElement } from 'react';
import {
  ButtonLink,
  SectionHeading,
  VideoPlayer,
  VideoPlayerButton,
  VideoPlayerModal,
  VideoPlayerOverlay,
  VideoPlayerProvider,
  VideoPlayerThumbnail,
} from '@nx/nx-dev-ui-common';
import { sendCustomEvent } from '@nx/nx-dev-feature-analytics';
import { EnvelopeIcon } from '@heroicons/react/24/outline';
import { UkgIcon } from '@nx/nx-dev-ui-icons';
import { WebinarSection } from '../../webinar-section';

export function SolutionsEngineeringHero(): ReactElement {
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
            Build confidently, ship faster{' '}
            <span className="rounded-lg bg-gradient-to-r from-blue-500 to-sky-500 bg-clip-text text-transparent">
              without waiting on your tools
            </span>
          </SectionHeading>
          <SectionHeading
            as="p"
            variant="subtitle"
            className="mx-auto mt-6 max-w-3xl lg:pr-20"
          >
            Accelerate your CI with Nx: smart cache sharing, flaky-test
            auto‑retries, parallel runs & dynamic agents.
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
                  'solutions-engineering-hero',
                  'solutions-engineering'
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
                  'contact-sales-click',
                  'solutions-engineering-hero',
                  'solutions-engineering'
                )
              }
            >
              <EnvelopeIcon aria-hidden="true" className="size-4" />
              <span>Subscribe to the newsletter</span>
            </ButtonLink>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <div id="video-player">
            <VideoPlayerProvider
              videoUrl="https://youtu.be/rSC8wihnfP4"
              analytics={{
                event: 'ukg-testimonial-video-click',
                category: 'ukg-testimonial-solutions',
                label: 'solutions',
              }}
            >
              <VideoPlayer>
                <VideoPlayerThumbnail
                  src="/images/customers/video-story-ukg.avif"
                  alt="video still"
                  width={960}
                  height={540}
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
              <UkgIcon
                aria-hidden="true"
                className="size-10 flex-none shrink-0 text-[#005151] dark:text-white"
              />
              <div>
                Discover how UKG reduced build times while scaling development
                across teams with Nx.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

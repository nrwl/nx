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
import { UkgIcon } from '@nx/nx-dev-ui-icons';
import { WebinarSection } from '../../webinar-section';

export function SolutionsManagementHero(): ReactElement {
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
            Standardize, scale,{' '}
            <span className="rounded-lg bg-gradient-to-r from-blue-500 to-sky-500 bg-clip-text text-transparent">
              ship faster with less waste
            </span>
          </SectionHeading>
          <SectionHeading
            as="p"
            variant="subtitle"
            className="mx-auto mt-6 max-w-3xl lg:pr-20"
          >
            Build, test, and deploy software more efficiently with powerful repo
            tools and intelligent CI, freeing your teams to innovate faster.
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
                  'solutions-management-hero',
                  'solutions-management'
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
                  'solutions-management-hero',
                  'solutions-management'
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

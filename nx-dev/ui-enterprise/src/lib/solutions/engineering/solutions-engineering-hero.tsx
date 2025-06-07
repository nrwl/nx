import { ComponentProps, ReactElement, useState } from 'react';
import { ButtonLink, SectionHeading, VideoModal } from '@nx/nx-dev/ui-common';
import { sendCustomEvent } from '@nx/nx-dev/feature-analytics';
import { EnvelopeIcon, PlayIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { UkgIcon } from '@nx/nx-dev-ui-icons';
import { cx } from '@nx/nx-dev-ui-primitives';
import { MovingBorder } from '@nx/nx-dev-ui-animations';
import { motion } from 'framer-motion';
import { WebinarSection } from '../../webinar-section';

function PlayButton({
  className,
  ...props
}: ComponentProps<'div'>): ReactElement {
  const parent = {
    initial: {
      width: 82,
      transition: {
        when: 'afterChildren',
      },
    },
    hover: {
      width: 296,
      transition: {
        duration: 0.125,
        type: 'tween',
        ease: 'easeOut',
      },
    },
  };
  const child = {
    initial: {
      opacity: 0,
      x: -6,
    },
    hover: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.015,
        type: 'tween',
        ease: 'easeOut',
      },
    },
  };

  return (
    <div
      className={cx(
        'group relative overflow-hidden rounded-full bg-transparent p-[1px] shadow-md',
        className
      )}
      {...props}
    >
      <div className="absolute inset-0">
        <MovingBorder duration={5000} rx="5%" ry="5%">
          <div className="size-20 bg-[radial-gradient(var(--blue-500)_40%,transparent_60%)] opacity-[0.8] dark:bg-[radial-gradient(var(--pink-500)_40%,transparent_60%)]" />
        </MovingBorder>
      </div>
      <motion.div
        initial="initial"
        whileHover="hover"
        variants={parent}
        className="relative isolate flex size-20 cursor-pointer items-center justify-center gap-6 rounded-full border-2 border-slate-100 bg-white/10 p-6 text-white antialiased backdrop-blur-xl"
      >
        <PlayIcon aria-hidden="true" className="absolute left-6 top-6 size-8" />
        <motion.div variants={child} className="absolute left-20 top-4 w-48">
          <p className="text-base font-medium">Watch the interview</p>
          <p className="text-xs">Under 3 minutes.</p>
        </motion.div>
      </motion.div>
    </div>
  );
}

export function SolutionsEngineeringHero(): ReactElement {
  const [isOpen, setIsOpen] = useState(false);

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
          <div>
            <div className="relative">
              <Image
                src="/images/customers/video-story-ukg.avif"
                alt="video still"
                width={960}
                height={540}
                loading="lazy"
                unoptimized
                className="relative rounded-xl"
              />

              <div className="absolute inset-0 grid h-full w-full items-center justify-center">
                <PlayButton
                  onClick={() => {
                    setIsOpen(true);
                    sendCustomEvent(
                      'ukg-testimonial-video-click',
                      'ukg-testimonial-solutions',
                      'solutions'
                    );
                  }}
                />
              </div>
            </div>
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

          <VideoModal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            videoUrl="https://youtu.be/rSC8wihnfP4"
          />
        </div>
      </div>
    </section>
  );
}

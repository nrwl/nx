'use client';

import { ComponentProps, ReactElement, useState } from 'react';
import { SectionHeading, computeThumbnailURL } from '@nx/nx-dev-ui-common';
import {
  BoltIcon,
  RocketLaunchIcon,
  PuzzlePieceIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { VideoModal } from '@nx/nx-dev-ui-common';
import { sendCustomEvent } from '@nx/nx-dev-feature-analytics';
import { motion } from 'framer-motion';
import { MovingBorder } from '@nx/nx-dev/ui-animations';
import { cx } from '@nx/nx-dev-ui-primitives';
import Image from 'next/image';

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
          <p className="text-base font-medium">Watch the video</p>
          <p className="text-xs">Learn how Nx works.</p>
        </motion.div>
      </motion.div>
    </div>
  );
}

export function NxBenefitsVideo(): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const videoUrl = 'https://youtu.be/qotrgWQKqZQ';
  const thumbnailUrl = computeThumbnailURL(videoUrl);

  return (
    <div className="border-b border-t border-slate-200 bg-slate-50 py-16 sm:py-8 dark:border-slate-800 dark:bg-slate-900">
      <section
        id="nx-benefits-video"
        className="z-0 mx-auto max-w-7xl scroll-mt-20 px-4 sm:px-6 lg:px-8"
      >
        <div className="md:grid md:grid-cols-2 md:items-center md:gap-10 lg:gap-12">
          <div className="mb-24 block sm:px-6 md:mb-0">
            <div className="relative">
              <div className="absolute bottom-0 start-0 -translate-x-14 translate-y-10">
                <svg
                  className="h-auto max-w-40 text-slate-200 dark:text-slate-800"
                  width="696"
                  height="653"
                  viewBox="0 0 696 653"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="72.5" cy="29.5" r="29.5" fill="currentColor" />
                  <circle cx="171.5" cy="29.5" r="29.5" fill="currentColor" />
                  <circle cx="270.5" cy="29.5" r="29.5" fill="currentColor" />
                  <circle cx="369.5" cy="29.5" r="29.5" fill="currentColor" />
                  <circle cx="468.5" cy="29.5" r="29.5" fill="currentColor" />
                  <circle cx="567.5" cy="29.5" r="29.5" fill="currentColor" />
                  <circle cx="666.5" cy="29.5" r="29.5" fill="currentColor" />
                  <circle cx="29.5" cy="128.5" r="29.5" fill="currentColor" />
                  <circle cx="128.5" cy="128.5" r="29.5" fill="currentColor" />
                  <circle cx="227.5" cy="128.5" r="29.5" fill="currentColor" />
                  <circle cx="326.5" cy="128.5" r="29.5" fill="currentColor" />
                  <circle cx="425.5" cy="128.5" r="29.5" fill="currentColor" />
                  <circle cx="524.5" cy="128.5" r="29.5" fill="currentColor" />
                  <circle cx="623.5" cy="128.5" r="29.5" fill="currentColor" />
                  <circle cx="72.5" cy="227.5" r="29.5" fill="currentColor" />
                  <circle cx="171.5" cy="227.5" r="29.5" fill="currentColor" />
                  <circle cx="270.5" cy="227.5" r="29.5" fill="currentColor" />
                  <circle cx="369.5" cy="227.5" r="29.5" fill="currentColor" />
                  <circle cx="468.5" cy="227.5" r="29.5" fill="currentColor" />
                  <circle cx="567.5" cy="227.5" r="29.5" fill="currentColor" />
                  <circle cx="666.5" cy="227.5" r="29.5" fill="currentColor" />
                  <circle cx="29.5" cy="326.5" r="29.5" fill="currentColor" />
                  <circle cx="128.5" cy="326.5" r="29.5" fill="currentColor" />
                  <circle cx="227.5" cy="326.5" r="29.5" fill="currentColor" />
                  <circle cx="326.5" cy="326.5" r="29.5" fill="currentColor" />
                  <circle cx="425.5" cy="326.5" r="29.5" fill="currentColor" />
                  <circle cx="524.5" cy="326.5" r="29.5" fill="currentColor" />
                  <circle cx="623.5" cy="326.5" r="29.5" fill="currentColor" />
                  <circle cx="72.5" cy="425.5" r="29.5" fill="currentColor" />
                  <circle cx="171.5" cy="425.5" r="29.5" fill="currentColor" />
                  <circle cx="270.5" cy="425.5" r="29.5" fill="currentColor" />
                  <circle cx="369.5" cy="425.5" r="29.5" fill="currentColor" />
                  <circle cx="468.5" cy="425.5" r="29.5" fill="currentColor" />
                  <circle cx="567.5" cy="425.5" r="29.5" fill="currentColor" />
                  <circle cx="666.5" cy="425.5" r="29.5" fill="currentColor" />
                  <circle cx="29.5" cy="524.5" r="29.5" fill="currentColor" />
                  <circle cx="128.5" cy="524.5" r="29.5" fill="currentColor" />
                  <circle cx="227.5" cy="524.5" r="29.5" fill="currentColor" />
                  <circle cx="326.5" cy="524.5" r="29.5" fill="currentColor" />
                  <circle cx="425.5" cy="524.5" r="29.5" fill="currentColor" />
                  <circle cx="524.5" cy="524.5" r="29.5" fill="currentColor" />
                  <circle cx="623.5" cy="524.5" r="29.5" fill="currentColor" />
                  <circle cx="72.5" cy="623.5" r="29.5" fill="currentColor" />
                  <circle cx="171.5" cy="623.5" r="29.5" fill="currentColor" />
                  <circle cx="270.5" cy="623.5" r="29.5" fill="currentColor" />
                  <circle cx="369.5" cy="623.5" r="29.5" fill="currentColor" />
                  <circle cx="468.5" cy="623.5" r="29.5" fill="currentColor" />
                  <circle cx="567.5" cy="623.5" r="29.5" fill="currentColor" />
                  <circle cx="666.5" cy="623.5" r="29.5" fill="currentColor" />
                </svg>
              </div>

              <Image
                src={thumbnailUrl}
                alt="Nx tutorial video thumbnail"
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
                      'nx-benefits-video-click',
                      'nx-benefits-video',
                      'react'
                    );
                  }}
                />
              </div>
            </div>
          </div>

          <div className="w-full flex-auto">
            <a
              href="https://nx.dev/recipes/adopting-nx/adding-to-monorepo"
              className="group block"
            >
              <div className="mt-8 flex gap-4 rounded-lg p-3 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                <BoltIcon
                  aria-hidden="true"
                  className="size-6 shrink-0 text-blue-500"
                />
                <div>
                  <h4 className="relative text-base font-medium leading-6 text-slate-900 group-hover:text-blue-500 dark:text-slate-100 dark:group-hover:text-blue-400">
                    Add Nx to any existing monorepo
                    <span className="ml-1 opacity-0 transition-opacity group-hover:opacity-100">
                      →
                    </span>
                  </h4>
                  <p className="mt-2">
                    Nx seamlessly integrates into your existing React monorepo
                    with a simple <code>nx init</code> command, providing
                    immediate benefits without disrupting your workflow.
                  </p>
                </div>
              </div>
            </a>

            <a
              href="https://nx.dev/features/cache-task-results"
              className="group block"
            >
              <div className="mt-8 flex gap-4 rounded-lg p-3 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                <RocketLaunchIcon
                  aria-hidden="true"
                  className="size-6 shrink-0 text-blue-500"
                />
                <div>
                  <h4 className="relative text-base font-medium leading-6 text-slate-900 group-hover:text-blue-500 dark:text-slate-100 dark:group-hover:text-blue-400">
                    Immediate speed and efficiency gains
                    <span className="ml-1 opacity-0 transition-opacity group-hover:opacity-100">
                      →
                    </span>
                  </h4>
                  <p className="mt-2">
                    Dramatically improve build times by running tasks in
                    parallel with local and remote caching that intelligently
                    avoids unnecessary work and keeps your team in sync.
                  </p>
                </div>
              </div>
            </a>

            <a href="https://nx.dev/plugin-registry" className="group block">
              <div className="mt-8 flex gap-4 rounded-lg p-3 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                <PuzzlePieceIcon
                  aria-hidden="true"
                  className="size-6 shrink-0 text-blue-500"
                />
                <div>
                  <h4 className="relative text-base font-medium leading-6 text-slate-900 group-hover:text-blue-500 dark:text-slate-100 dark:group-hover:text-blue-400">
                    Enhanced developer experience
                    <span className="ml-1 opacity-0 transition-opacity group-hover:opacity-100">
                      →
                    </span>
                  </h4>
                  <p className="mt-2">
                    Add optional Nx plugins to boost your development workflow
                    with low-level monorepo configuration assistance,
                    streamlined tooling, and specialized generators for your
                    tech stack.
                  </p>
                </div>
              </div>
            </a>
          </div>
        </div>
      </section>

      <VideoModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        videoUrl={videoUrl}
      />
    </div>
  );
}

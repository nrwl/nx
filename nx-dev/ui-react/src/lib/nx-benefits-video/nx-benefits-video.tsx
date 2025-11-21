'use client';

import { ReactElement } from 'react';
import {
  computeThumbnailURL,
  VideoPlayer,
  VideoPlayerButton,
  VideoPlayerModal,
  VideoPlayerOverlay,
  VideoPlayerProvider,
  VideoPlayerThumbnail,
} from '@nx/nx-dev-ui-common';
import {
  BoltIcon,
  PuzzlePieceIcon,
  RocketLaunchIcon,
} from '@heroicons/react/24/outline';

export function NxBenefitsVideo(): ReactElement {
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

              <VideoPlayerProvider
                videoUrl={videoUrl}
                analytics={{
                  event: 'nx-benefits-video-click',
                  category: 'nx-benefits-video',
                  label: 'react',
                }}
              >
                <VideoPlayer>
                  <VideoPlayerThumbnail
                    src={thumbnailUrl}
                    alt="Nx tutorial video thumbnail"
                    width={960}
                    height={540}
                  />
                  <VideoPlayerOverlay>
                    <VideoPlayerButton
                      text={{
                        primary: 'Watch the video',
                        secondary: 'Learn how Nx works.',
                      }}
                    />
                  </VideoPlayerOverlay>
                </VideoPlayer>
                <VideoPlayerModal />
              </VideoPlayerProvider>
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
    </div>
  );
}

import { ButtonLink } from '@nx/nx-dev/ui-common';
import { cx } from '@nx/nx-dev/ui-primitives';
import React, { ReactElement } from 'react';
import Link from 'next/link';

export function CallToAction(): ReactElement {
  return (
    <section className="relative isolate px-6 py-12 lg:px-8">
      {/* Background pattern */}
      <svg
        className="absolute inset-0 -z-10 h-full w-full stroke-black/10 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)] dark:stroke-white/10"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="ai-cta-pattern"
            width={200}
            height={200}
            x="50%"
            y={0}
            patternUnits="userSpaceOnUse"
          >
            <path d="M.5 200V.5H200" fill="none" />
          </pattern>
        </defs>
        <svg
          x="50%"
          y={0}
          className="overflow-visible fill-slate-200/20 dark:fill-slate-800/20"
        >
          <path
            d="M-200 0h201v201h-201Z M600 0h201v201h-201Z M-400 600h201v201h-201Z M200 800h201v201h-201Z"
            strokeWidth={0}
          />
        </svg>
        <rect
          width="100%"
          height="100%"
          strokeWidth={0}
          fill="url(#ai-cta-pattern)"
        />
      </svg>

      {/* Gradient background */}
      <div
        className="pointer-events-none absolute inset-x-0 top-10 -z-10 flex transform-gpu justify-center overflow-hidden blur-3xl"
        aria-hidden="true"
      >
        <div
          className="aspect-[1108/632] w-[69.25rem] flex-none bg-gradient-to-r from-blue-500 to-blue-600 opacity-20"
          style={{
            clipPath:
              'polygon(73.6% 51.7%, 91.7% 11.8%, 100% 46.4%, 97.4% 82.2%, 92.5% 84.9%, 75.7% 64%, 55.3% 47.5%, 46.5% 49.4%, 45% 62.9%, 50.3% 87.2%, 21.3% 64.1%, 0.1% 100%, 5.4% 51.1%, 21.4% 63.9%, 58.9% 0.2%, 73.6% 51.7%)',
          }}
        />
      </div>

      {/* Content */}
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-medium tracking-tight text-slate-950 sm:text-5xl dark:text-white">
          Transform your AI assistant in minutes
        </h2>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Link
            href="/features/enhance-AI#setting-up-nx-mcp"
            title="Get started with Nx AI integration"
            prefetch={false}
            className="rounded-md bg-slate-950 px-3.5 py-2.5 text-sm font-semibold text-slate-100 shadow-sm hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Start here{' '}
            <span
              aria-hidden="true"
              className="inline-block transition group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
          {/* <Link
            href="https://youtu.be/RNilYmJJzdk"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold leading-6 text-slate-900 dark:text-white"
          >
            Watch 3-min Demo <span aria-hidden="true">→</span>
          </Link> */}
        </div>
      </div>
    </section>
  );
}

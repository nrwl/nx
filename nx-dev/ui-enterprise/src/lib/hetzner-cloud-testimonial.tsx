import { ComponentProps, Fragment, ReactElement, useState } from 'react';
import { Button, SectionHeading } from '@nx/nx-dev/ui-common';
import { HetznerCloudIcon } from '@nx/nx-dev/ui-icons';
import Link from 'next/link';
import { cx } from '@nx/nx-dev/ui-primitives';
import { MovingBorder } from '@nx/nx-dev/ui-animations';
import { motion } from 'framer-motion';
import { PlayIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { Dialog, Transition } from '@headlessui/react';
import { sendCustomEvent } from '@nx/nx-dev/feature-analytics';

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

export function HetznerCloudTestimonial(): ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-t border-slate-200 bg-slate-50 py-24 sm:py-32 dark:border-slate-800 dark:bg-slate-900">
      <section
        id="hetzner-cloud-testimonial"
        className="z-0 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
      >
        <SectionHeading as="h2" variant="title" id="hetzner-cloud-testimonial">
          Nx Enterprise{' '}
          <span className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
            speeds build and test times
          </span>{' '}
          <br className="hidden md:block" />
          as Hetzner Cloud{' '}
          <span className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
            scales up
          </span>{' '}
          product offering
        </SectionHeading>
        <div className="mt-8 md:grid md:grid-cols-2 md:items-center md:gap-10 lg:gap-12">
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
                src="/images/enterprise/video-story-pavlo-grosse.avif"
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
                      'hetzner-cloud-testimonial-video-click',
                      'hetzner-cloud-testimonial',
                      'enterprise'
                    );
                  }}
                />
              </div>
            </div>
          </div>

          <figure>
            <blockquote className="relative">
              <svg
                className="absolute start-0 top-0 size-24 -translate-x-8 -translate-y-4 transform text-slate-200 dark:text-slate-800"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M7.39762 10.3C7.39762 11.0733 7.14888 11.7 6.6514 12.18C6.15392 12.6333 5.52552 12.86 4.76621 12.86C3.84979 12.86 3.09047 12.5533 2.48825 11.94C1.91222 11.3266 1.62421 10.4467 1.62421 9.29999C1.62421 8.07332 1.96459 6.87332 2.64535 5.69999C3.35231 4.49999 4.33418 3.55332 5.59098 2.85999L6.4943 4.25999C5.81354 4.73999 5.26369 5.27332 4.84476 5.85999C4.45201 6.44666 4.19017 7.12666 4.05926 7.89999C4.29491 7.79332 4.56983 7.73999 4.88403 7.73999C5.61716 7.73999 6.21938 7.97999 6.69067 8.45999C7.16197 8.93999 7.39762 9.55333 7.39762 10.3ZM14.6242 10.3C14.6242 11.0733 14.3755 11.7 13.878 12.18C13.3805 12.6333 12.7521 12.86 11.9928 12.86C11.0764 12.86 10.3171 12.5533 9.71484 11.94C9.13881 11.3266 8.85079 10.4467 8.85079 9.29999C8.85079 8.07332 9.19117 6.87332 9.87194 5.69999C10.5789 4.49999 11.5608 3.55332 12.8176 2.85999L13.7209 4.25999C13.0401 4.73999 12.4903 5.27332 12.0713 5.85999C11.6786 6.44666 11.4168 7.12666 11.2858 7.89999C11.5215 7.79332 11.7964 7.73999 12.1106 7.73999C12.8437 7.73999 13.446 7.97999 13.9173 8.45999C14.3886 8.93999 14.6242 9.55333 14.6242 10.3Z"
                  fill="currentColor"
                />
              </svg>

              <div className="relative z-10">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-200">
                  Featured client
                </p>

                <p className="text-xl font-medium italic text-slate-800 md:text-2xl md:leading-normal xl:text-3xl xl:leading-normal dark:text-neutral-200">
                  Nx is speed and scalability. Before we only had a few features
                  and CI was slow and now it’s fast with way more features.
                  That’s a huge win for us.”.
                </p>
              </div>

              <figcaption className="mt-6 flex flex-wrap items-center gap-4 sm:flex-nowrap">
                <img
                  alt="pavlo grosse"
                  src="https://avatars.githubusercontent.com/u/2219064?v=4"
                  className="size-12 flex-none rounded-full bg-gray-50"
                />
                <div className="flex-auto">
                  <div className="text-base font-semibold">Pavlo Grosse</div>
                  <div className="text-xs text-slate-600 dark:text-slate-500">
                    Senior Software Engineer, Hetzner Cloud
                  </div>
                </div>
                <HetznerCloudIcon
                  aria-hidden="true"
                  className="mx-auto size-10 flex-none bg-white text-[#D50C2D]"
                />
              </figcaption>

              <footer className="mt-8 flex items-center gap-6">
                <Button
                  title="Watch the customer story"
                  variant="secondary"
                  size="small"
                  onClick={() => {
                    setIsOpen(true);
                    sendCustomEvent(
                      'hetzner-cloud-testimonial-video-click',
                      'hetzner-cloud-testimonial',
                      'enterprise'
                    );
                  }}
                >
                  <PlayIcon aria-hidden="true" className="size-5 shrink-0" />
                  <span>Watch the customer story</span>
                </Button>
                <Link
                  href="/customers"
                  prefetch={false}
                  className="text-sm/6 font-semibold"
                >
                  See our customers <span aria-hidden="true">→</span>
                </Link>
              </footer>
            </blockquote>
          </figure>
        </div>
        {/*MODAL*/}
        <Transition appear show={isOpen} as={Fragment}>
          <Dialog
            as="div"
            open={isOpen}
            onClose={() => setIsOpen(false)}
            className="relative z-10"
          >
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
            </Transition.Child>
            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4 text-center">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="relative w-auto transform overflow-hidden rounded-2xl border border-slate-950 bg-black text-left align-middle shadow-xl transition-all focus:outline-none">
                    <iframe
                      width="808"
                      height="454"
                      src="https://www.youtube.com/embed/2BLqiNnBPuU?si=752RGHhozOMzbWlx"
                      title="YouTube video player"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="max-w-full"
                    />
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      </section>
    </div>
  );
}

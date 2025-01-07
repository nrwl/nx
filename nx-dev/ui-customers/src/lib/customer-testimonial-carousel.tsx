'use client';
import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { PlayIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import {
  CasewareIcon,
  HetznerCloudIcon,
  PayfitIcon,
  SiriusxmIcon,
  UkgIcon,
  VmwareIcon,
} from '@nx/nx-dev/ui-icons';
interface Testimonial {
  title: string;
  subtitle: string;
  metrics?: {
    value: string;
    label: string;
  }[];
  quote?: {
    text: string;
    author: {
      name: string;
      role: string;
    };
  };
  company: string;
  videoId: string;
  thumbnail: string;
  logo: {
    icon: any;
    height: string;
    width: string;
  };
}

const testimonials: Testimonial[] = [
  {
    title: 'Customer story',
    subtitle:
      'How Hetzner Cloud solved the Performance Paradox: Faster builds with more features',
    metrics: [
      { value: 'Faster CI', label: 'More projects, less time' },
      { value: 'Seconds', label: 'From 20min CI to instant builds' },
    ],
    company: 'Hetzner',
    videoId: '2BLqiNnBPuU',
    thumbnail: '/images/customers/video-story-pavlo-grosse.avif',
    logo: {
      icon: HetznerCloudIcon,
      height: 'h-10',
      width: 'w-10',
    },
  },
  {
    title: 'Customer story',
    subtitle:
      'Scaling 700+ projects: How Nx Enterprise became a no-brainer for Caseware',
    metrics: [
      { value: '700+', label: 'Monorepo projects scaled effortlessly' },
      {
        value: 'Efficiency',
        label: 'Unified workflows: frontend to backend',
      },
    ],
    company: 'Caseware',
    videoId: 'lvS8HjjFwEM',
    thumbnail: '/images/customers/video-story-caseware.avif',
    logo: {
      icon: CasewareIcon,
      height: 'h-12',
      width: 'w-12',
    },
  },
  {
    title: 'Customer story',
    subtitle:
      'How SiriusXM stays competitive by iterating and getting to market fast',
    quote: {
      text: 'For me Nx means tooling and efficiency around our software development lifecycle that empowers us to move faster and ship code more reliably.',
      author: {
        name: 'Justin Schwartzenberger',
        role: 'Principal Software Engineer',
      },
    },
    company: 'SiriusXM',
    videoId: 'Q0ky-8oJcro',
    thumbnail: '/images/customers/video-story-siriusxm.avif',
    logo: {
      icon: SiriusxmIcon,
      height: 'h-32',
      width: 'w-32',
    },
  },
  {
    title: 'Customer story',
    subtitle:
      'From 5 days to 2 hours: How Payfit improved velocity and offloads complexity',
    metrics: [
      { value: '2h vs 5 days', label: 'Faster delivery with Nx and Nx Cloud' },
      {
        value: 'Offload complexity',
        label: 'Nx Agents handle the load, automatically',
      },
    ],
    company: 'Payfit',
    videoId: 'Vdk-tza4PCs',
    thumbnail: '/images/customers/video-story-payfit.avif',
    logo: {
      icon: PayfitIcon,
      height: 'h-16',
      width: 'w-16',
    },
  },
  {
    title: 'Customer story',
    subtitle:
      'How UKG reduced build times while scaling development across teams',
    metrics: [
      { value: 'Web + Mobile', label: 'Maximum code reuse' },
      { value: 'Zero Tuning', label: 'CI that just works' },
    ],
    quote: {
      text: "I can't see a future where we don't have Nx.",
      author: {
        name: 'Sid Govindaraju',
        role: 'Engineering Manager',
      },
    },
    company: 'UKG',
    videoId: 'rSC8wihnfP4',
    thumbnail: '/images/customers/video-story-ukg.avif',
    logo: {
      icon: UkgIcon,
      height: 'h-20',
      width: 'w-20',
    },
  },
  {
    title: 'Customer story',
    subtitle: 'How Broadcom stays efficient and nimble with monorepos',
    quote: {
      text: "The best developer experience I've had in my career.",
      author: {
        name: 'Laurent Delamare',
        role: 'Frontend Architect',
      },
    },
    company: 'Broadcom (VMware)',
    videoId: 'RWTgYNKqxNc',
    thumbnail: '/images/customers/video-story-broadcom.avif',
    logo: {
      icon: VmwareIcon,
      height: 'h-28',
      width: 'w-28',
    },
  },
];

export function CustomerTestimonialCarousel(): JSX.Element {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const currentTestimonial = testimonials[currentIndex];
  const slideLogoTimeOut = 12000; // 12 seconds

  useEffect(() => {
    let timer: NodeJS.Timeout;

    // Clear the current timer and start a new one
    if (!isOpen) {
      timer = setInterval(() => {
        setCurrentIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % testimonials.length;
          return nextIndex;
        });
      }, slideLogoTimeOut);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      clearInterval(timer);
    };
  }, [currentIndex, setCurrentIndex, isOpen]);

  return (
    <div className="w-full">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2 px-4 lg:grid-cols-4 lg:gap-4">
        {/* Left side - Quote or Metrics */}
        <div className="col-span hidden lg:block">
          {currentTestimonial.quote ? (
            <figure className="flex h-full flex-col justify-center">
              <blockquote className="relative">
                {/* Quote mark SVG */}
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
                  <p className="text-xl font-medium italic text-slate-800 md:text-2xl md:leading-normal xl:text-3xl xl:leading-normal dark:text-neutral-200">
                    "{currentTestimonial.quote.text}"
                  </p>
                </div>

                <figcaption className="mt-6 flex items-center gap-4">
                  <div className="flex-auto">
                    <div className="text-base font-semibold">
                      {currentTestimonial.quote.author.name}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-500">
                      {currentTestimonial.quote.author.role},{' '}
                      {currentTestimonial.company}
                    </div>
                  </div>
                </figcaption>
              </blockquote>
            </figure>
          ) : (
            <div className="flex h-full flex-col justify-center space-y-8">
              {currentTestimonial.metrics?.map((metric, index) => (
                <div key={index} className="space-y-2">
                  <div className="text-4xl font-bold text-blue-500 lg:text-5xl">
                    {metric.value}
                  </div>
                  <div className="text-base text-slate-500 lg:text-lg dark:text-slate-400">
                    {metric.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right side - Video Card */}
        <div className="col-span-2 md:col-span-3">
          <div className="flex items-center gap-4">
            <div
              className="group relative h-[450px] w-full cursor-pointer self-stretch overflow-hidden rounded-lg xl:shadow-2xl"
              onClick={() => setIsOpen(true)}
            >
              {/* Thumbnail */}
              <Image
                quality={100}
                src={currentTestimonial.thumbnail}
                alt={currentTestimonial.title}
                fill
                className="mb-4 aspect-video h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 from-25% via-black/20" />

              {/* Content Overlay */}
              <div className="absolute bottom-0 left-0 p-8">
                <h3 className="text-xl font-semibold text-white md:text-2xl lg:text-3xl">
                  {currentTestimonial.subtitle}
                </h3>
                <button className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20">
                  <PlayIcon className="size-5" />
                  Watch video
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Navigation display dots */}
          <ul className="mt-4 flex justify-center gap-2 md:hidden">
            {testimonials.map((_, index) => (
              <li
                key={index}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'w-12 bg-blue-500'
                    : 'w-4 bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </ul>
        </div>
      </div>

      {/* Carosel Navigation */}
      <div className="relative mx-auto hidden max-w-7xl grid-cols-6 items-center justify-center px-4 pt-16 md:grid">
        {testimonials.map(({ company, logo }, i) => (
          <button
            onClick={() => setCurrentIndex(i)}
            key={`firstSet-logo-${i}`}
            title={company}
            className={`relative grid h-full w-full place-items-center border border-slate-200/15 transition-all dark:border-slate-800/20 ${
              i === currentIndex
                ? 'text-blue-600 hover:text-blue-700 dark:text-blue-500 dark:hover:text-blue-300'
                : 'text-slate-400 hover:text-slate-500 dark:text-slate-700 dark:hover:text-slate-500'
            }`}
          >
            <logo.icon
              key={`firstSet-icon-${i}`}
              className={`${logo.height} ${logo.width} transition-transform duration-300`}
            />

            {/* Progress Bar at the Top */}
            {i === currentIndex && !isOpen && (
              <div className="absolute left-0 top-0 h-[2px] w-full overflow-hidden bg-gray-300/80 transition-all">
                <div
                  className="animate-progress h-full w-full bg-sky-600/80"
                  style={{ animationDuration: `${slideLogoTimeOut}ms` }}
                />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Video Modal */}
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog
          as="div"
          open={isOpen}
          onClose={() => setIsOpen(false)}
          className="relative z-50"
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
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-4xl overflow-hidden rounded-2xl bg-black shadow-2xl">
                  <div className="aspect-video">
                    <iframe
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/${currentTestimonial.videoId}`}
                      title="Customer Success Story"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="h-full w-full"
                    />
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}

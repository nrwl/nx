'use client';
import {
  Fragment,
  useState,
  useEffect,
  FC,
  SVGProps,
  type ReactElement,
} from 'react';
import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';

import {
  CasewareIcon,
  HetznerCloudIcon,
  PayfitIcon,
  SiriusxmIcon,
  UkgIcon,
  VmwareIcon,
} from '@nx/nx-dev-ui-icons';
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
    icon: FC<SVGProps<SVGSVGElement>>;
    height: string;
    width: string;
    color?: string;
  };
}

const testimonials: Testimonial[] = [
  {
    title: 'Customer story',
    subtitle:
      'How Hetzner Cloud solved the Performance Paradox: Faster builds with more features',
    metrics: [
      { value: 'Faster tests', label: 'From 20 min -> seconds.' },
      { value: 'Faster builds', label: 'Down from 30 minutes.' },
      { value: 'Speed & scale', label: 'Faster CI with even more features.' },
    ],
    company: 'Hetzner',
    videoId: '2BLqiNnBPuU',
    thumbnail: '/images/customers/video-story-pavlo-grosse.avif',
    logo: {
      icon: HetznerCloudIcon,
      height: 'h-10',
      width: 'w-10',
      color: 'text-[#D50C2D]',
    },
  },
  {
    title: 'Customer story',
    subtitle:
      'Scaling 700+ projects: How Nx Enterprise became a no-brainer for Caseware',
    metrics: [
      {
        value: 'Massive scale',
        label: '700+ projects, unifying frontends and backends company wide.',
      },
      {
        value: 'Instant impact',
        label: 'Trialing Nx Enterprise cut build times immediately.',
      },
      {
        value: 'Actionable insights',
        label:
          'Nx Cloud’s metrics uncovered inefficiencies across 10+ year old codebase.',
      },
    ],
    company: 'Caseware',
    videoId: 'lvS8HjjFwEM',
    thumbnail: '/images/customers/video-story-caseware.avif',
    logo: {
      icon: CasewareIcon,
      height: 'h-12',
      width: 'w-12',
      color: 'text-[#F56354]',
    },
  },
  {
    title: 'Customer story',
    subtitle:
      'How SiriusXM stays competitive by iterating and getting to market fast',
    metrics: [
      {
        value: 'Faster releases',
        label:
          'Nx streamlines feature management, accelerating delivery cycles.',
      },
      {
        value: 'Seamless adoption',
        label:
          'Nx Cloud integration delivers continuous benefits from day one.',
      },
      {
        value: 'Expert guidance',
        label:
          'Nx Enterprise support provides quick, informed assistance on demand.',
      },
    ],
    company: 'SiriusXM',
    videoId: 'Q0ky-8oJcro',
    thumbnail: '/images/customers/video-story-siriusxm.avif',
    logo: {
      icon: SiriusxmIcon,
      height: 'h-32',
      width: 'w-32',
      color: 'text-[#0000EB]',
    },
  },
  {
    title: 'Customer story',
    subtitle:
      'From 5 days to 2 hours: How Payfit improved velocity and offloads complexity',
    metrics: [
      {
        value: 'From 5 days → 2 hours',
        label: 'Nx & Nx Cloud drastically accelerate feature deployment',
      },
      {
        value: 'Eliminated CI Complexity',
        label: 'Nx Cloud offloads CI load balancing headaches.',
      },
      {
        value: 'Faster time-to-market',
        label:
          'Nx boosts velocity, helping teams deliver faster and more reliably.',
      },
    ],
    company: 'Payfit',
    videoId: 'Vdk-tza4PCs',
    thumbnail: '/images/customers/video-story-payfit.avif',
    logo: {
      icon: PayfitIcon,
      height: 'h-16',
      width: 'w-16',
      color: 'text-[#0F6FDE]',
    },
  },
  {
    title: 'Customer story',
    subtitle:
      'How UKG reduced build times while scaling development across teams',
    metrics: [
      {
        value: 'From 1 day → instant builds',
        label: 'Nx Cloud slashed build wait times, enabling dev productivity.',
      },
      {
        value: 'Eliminated CI Maintenance',
        label:
          'Nx Cloud frees teams from managing CI, letting devs focus on code.',
      },
      {
        value: 'Reduced duplication',
        label:
          'Shared libraries cut down redundant code across mobile and web apps.',
      },
    ],
    company: 'UKG',
    videoId: 'rSC8wihnfP4',
    thumbnail: '/images/customers/video-story-ukg.avif',
    logo: {
      icon: UkgIcon,
      height: 'h-20',
      width: 'w-20',
      color: 'text-[#005151]',
    },
  },
  {
    title: 'Customer story',
    subtitle: 'How Broadcom stays efficient and nimble with monorepos',
    metrics: [
      {
        value: '2x faster',
        label: 'Nx doubles speed, supporting fast, nimble development.',
      },
      {
        value: 'Unmatched DX',
        label: 'Nx empowers teams to be more productive than ever.',
      },
      {
        value: 'Always ahead',
        label:
          'Nx’s rapid feature delivery keeps teams at the cutting edge of development.',
      },
    ],
    company: 'Broadcom (VMware)',
    videoId: 'RWTgYNKqxNc',
    thumbnail: '/images/customers/video-story-broadcom.avif',
    logo: {
      icon: VmwareIcon,
      height: 'h-28',
      width: 'w-28',
      color: 'text-[#607078]',
    },
  },
];

export function CustomerTestimonialCarousel(): ReactElement {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const currentTestimonial = testimonials[currentIndex];
  const slideLogoTimeOut = 12000; // 12 seconds

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (!isOpen) {
      timer = setInterval(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % testimonials.length);
      }, slideLogoTimeOut);
    }

    return () => {
      clearInterval(timer);
    };
  }, [currentIndex, setCurrentIndex, isOpen]);

  return (
    <div className="w-full">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2 px-4 lg:grid-cols-5 lg:gap-4">
        {/* Left side - Quote or Metrics */}
        <div className="col-span-2 hidden lg:block">
          <div className="flex h-full flex-col justify-center space-y-8">
            {currentTestimonial.metrics?.map((metric, index) => (
              <div key={index} className="space-y-2">
                <div className="border-l-2 border-blue-900/70 pl-4 text-3xl font-bold text-slate-700 dark:border-sky-300/60 dark:text-slate-200">
                  {metric.value}
                </div>
                <div className="text-balance pl-[18px] text-lg text-slate-500 dark:text-slate-400">
                  {metric.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right side - Video Card */}
        <div className="col-span-2 md:col-span-3">
          <div className="flex items-center gap-4">
            {/* Prev Button Mobile only */}
            <button
              disabled={currentIndex === 0}
              title={`See ${testimonials[currentIndex - 1]?.company}`}
              className="flex h-12 w-12 items-center justify-center rounded-full p-2 transition hover:text-slate-950 disabled:pointer-events-none disabled:opacity-0 md:hidden dark:hover:text-white"
              onClick={() => {
                setCurrentIndex(
                  (currentIndex - 1 + testimonials.length) % testimonials.length
                );
              }}
            >
              <span className="sr-only">Previous</span>
              <ChevronLeftIcon
                className="h-8 w-8 flex-shrink-0"
                aria-hidden="true"
              />
            </button>
            <div
              className="group relative h-56 w-full cursor-pointer self-stretch overflow-hidden rounded-lg sm:h-80 md:h-[450px] xl:shadow-2xl"
              onClick={() => setIsOpen(true)}
            >
              {/* Thumbnail */}
              <img
                src={currentTestimonial.thumbnail}
                alt={currentTestimonial.title}
                className="aspect-video h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 from-25% via-black/20" />

              {/* Content Overlay */}
              <div className="absolute bottom-0 left-0 p-4 md:p-8">
                <h3 className="text-base font-semibold text-white md:text-2xl lg:text-3xl">
                  {currentTestimonial.subtitle}
                </h3>
                <button className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20 md:mt-4 md:gap-2">
                  <PlayIcon className="size-3 md:size-5" aria-hidden="true" />
                  Watch video
                </button>
              </div>
            </div>
            {/* Next Button - Mobile only */}
            <button
              className="flex h-12 w-12 items-center justify-center rounded-full p-2 transition hover:text-slate-950 disabled:pointer-events-none disabled:opacity-0 md:hidden dark:hover:text-white"
              disabled={currentIndex === testimonials.length - 1}
              title={`Next ${testimonials[currentIndex + 1]?.company}`}
              onClick={() => {
                setCurrentIndex(
                  (currentIndex + 1 + testimonials.length) % testimonials.length
                );
              }}
            >
              <span className="sr-only">Next</span>
              <ChevronRightIcon
                className="h-8 w-8 flex-shrink-0"
                aria-hidden="true"
              />
            </button>
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

      {/* Carosel Navigation - Larger screens */}
      <div className="relative mx-auto hidden max-w-7xl grid-cols-6 items-center justify-center px-4 pt-16 md:grid">
        {testimonials.map(({ company, logo }, i) => (
          <button
            onClick={() => setCurrentIndex(i)}
            key={`logo-${i}`}
            title={company}
            className={`relative grid h-full w-full place-items-center border border-slate-200/15 transition-all dark:border-slate-800/20 ${
              i !== currentIndex &&
              'text-slate-400 hover:text-slate-500 dark:text-slate-700 dark:hover:text-slate-500'
            }`}
          >
            <span className="sr-only">{company} Logo</span>
            <logo.icon
              key={`logo-icon-${i}`}
              className={`${logo.height} ${logo.width} ${
                i === currentIndex && logo.color
              } transition`}
              aria-hidden="true"
            />

            {/* Progress Bar */}
            {i === currentIndex && !isOpen && (
              <div className="absolute left-0 top-0 h-[2px] w-full overflow-hidden bg-gray-300/80 transition-all">
                <div
                  className="animate-progress h-full w-full bg-blue-600/80 dark:bg-sky-600/80"
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
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-4xl overflow-hidden rounded-2xl bg-black shadow-2xl">
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
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}

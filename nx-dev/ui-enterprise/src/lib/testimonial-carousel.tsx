import { ReactElement, ReactNode, useRef, useState } from 'react';
import {
  CarouselHandle,
  CarouselRoot,
  CarouselSlide,
  CarouselViewport,
} from './carousel';
import { PayfitIcon, UkgIcon } from '@nx/nx-dev/ui-icons';
import { PlayIcon } from '@heroicons/react/24/outline';
import { sendCustomEvent } from '@nx/nx-dev/feature-analytics';
import { VideoModal } from '@nx/nx-dev/ui-common';

export function Carousel({
  items,
}: {
  items: { element: ReactNode; innerButtonElement: ReactNode }[];
}): ReactElement {
  const carouselRef = useRef<CarouselHandle>(null);
  const iterableItems = items.map((item, index) => ({
    ...item,
    id: crypto.randomUUID(),
  }));
  const [currentIndex, setCurrentIndex] = useState(0);
  const handleSlideChange = (index: number) => setCurrentIndex(index);

  return (
    <div className="w-full">
      {/* Main carousel section */}
      <CarouselRoot
        className="overflow-hidden rounded-lg xl:[box-shadow:0_50px_100px_-20px_rgba(50,50,93,0.25),_0_30px_60px_-30px_rgba(0,0,0,0.3)]"
        onSlideChange={handleSlideChange}
        enableKeyboardNavigation={true}
        autoPlayInterval={6000}
        ref={carouselRef}
      >
        <CarouselViewport>
          {iterableItems.map((item, index) => (
            <CarouselSlide key={item.id}>{item.element}</CarouselSlide>
          ))}
        </CarouselViewport>

        {/* Custom line-style indicators */}
        <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 gap-2">
          {iterableItems.map((_, index) => (
            <div
              key={index}
              className={`h-1 w-8 rounded-full transition-colors duration-300 ${
                index === currentIndex ? 'bg-white' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
      </CarouselRoot>

      {/* Partner logos section - now linked to carousel items */}
      <div className="mt-12 flex items-center justify-center divide-x divide-slate-200 dark:divide-slate-700">
        {iterableItems.map((item, index) => (
          <button
            key={item.id + '-logo'}
            onClick={() => carouselRef.current?.goToSlide(index)}
            className={`px-8 py-4 transition-all duration-300 ${
              index === currentIndex
                ? 'underline opacity-100 grayscale-0'
                : 'opacity-50 grayscale'
            }`}
          >
            {item.innerButtonElement}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TestimonialCarousel(): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [currentVideo, setCurrentVideo] = useState('');

  const openVideo = (videoUrl: string) => {
    setCurrentVideo(videoUrl);
    setIsOpen(true);
  };

  return (
    <section className="">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <Carousel
          items={[
            {
              element: (
                <div
                  onClick={() => {
                    openVideo('https://youtu.be/Vdk-tza4PCs');
                    sendCustomEvent(
                      'payfit-testimonial-video-click',
                      'testimonial-carousel',
                      'enterprise'
                    );
                  }}
                  className="group relative cursor-pointer overflow-hidden"
                >
                  <div
                    className="absolute inset-0 bg-opacity-75 bg-cover bg-center bg-no-repeat transition-transform duration-700 group-hover:scale-105"
                    style={{
                      backgroundImage:
                        "url('https://images.unsplash.com/photo-1511376868136-742c0de8c9a8?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')",
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0F6FDE] via-[#0F6FDE] via-70% to-[#0F6FDE]/40" />
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 opacity-0 backdrop-blur-sm transition duration-300 group-hover:opacity-100 dark:bg-slate-950/60">
                    <div className="flex items-center gap-2 text-lg font-semibold text-slate-950 drop-shadow dark:text-white">
                      <PlayIcon className="size-8" />
                      Watch the interview
                    </div>
                  </div>
                  <div className="relative mx-auto grid max-w-2xl grid-cols-1 px-12 py-16 text-white lg:mx-0 lg:max-w-none lg:grid-cols-4">
                    <div className="col-span-3 flex flex-col">
                      <figure className="flex flex-auto flex-col justify-between">
                        <blockquote className="text-pretty text-xl/8">
                          <p>
                            "The number of hours we spent trying to manage CI
                            before, trying to load balance in CircleCI, the
                            number of agents that we run ourselves by hand and
                            try to distribute ourselves manually - it was
                            painful, we'd spend hours and days trying to do
                            that.{' '}
                            <span className="font-semibold">
                              With Nx Cloud we don't need to think about that,
                              here is my task, deal with it and make it fast
                            </span>
                            ."
                          </p>
                        </blockquote>
                        <figcaption className="mt-10 flex items-center gap-x-6">
                          <img
                            alt="avatar"
                            src="https://avatars.githubusercontent.com/u/7281023?v=4"
                            className="size-14 rounded-full bg-slate-50"
                          />
                          <div className="text-base">
                            <div className="font-semibold">
                              Nicolas Beaussart
                            </div>
                            <div className="mt-1">
                              Staff Platform Engineer, Payfit
                            </div>
                          </div>
                        </figcaption>
                      </figure>
                    </div>
                    <div className="grid-col-1 grid place-items-center p-4">
                      <PayfitIcon
                        aria-hidden="true"
                        className="size-12 lg:size-20"
                      />
                    </div>
                  </div>
                </div>
              ),
              innerButtonElement: (
                <span className="text-2xl">Increase speed</span>
              ),
            },
            {
              element: (
                <div
                  onClick={() => {
                    openVideo('https://youtu.be/rSC8wihnfP4');
                    sendCustomEvent(
                      'ukg-testimonial-video-click',
                      'testimonial-carousel',
                      'enterprise'
                    );
                  }}
                  className="group relative cursor-pointer overflow-hidden"
                >
                  <div
                    className="absolute inset-0 bg-opacity-75 bg-cover bg-center bg-no-repeat transition-transform duration-700 group-hover:scale-105"
                    style={{
                      backgroundImage:
                        "url('https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')",
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#005151] via-[#005151] via-55% to-[#005151]/40" />
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 opacity-0 backdrop-blur-sm transition duration-300 group-hover:opacity-100 dark:bg-slate-950/60">
                    <div className="flex items-center gap-2 text-lg font-semibold text-slate-950 drop-shadow dark:text-white">
                      <PlayIcon className="size-8" />
                      Watch the interview
                    </div>
                  </div>
                  <div className="relative mx-auto grid max-w-2xl grid-cols-1 px-12 py-16 text-white lg:mx-0 lg:max-w-none lg:grid-cols-4">
                    <div className="col-span-2 flex flex-col">
                      <figure className="flex flex-auto flex-col justify-between">
                        <blockquote className="text-pretty text-xl/8">
                          <p>
                            "I really like the Nx check-ins - Nx people are very
                            well prepared for how to help their team grow and
                            scale and to help us spot some of our challenges. I
                            can't see a future where we don't have Nx."
                          </p>
                        </blockquote>
                        <figcaption className="mt-10 flex items-center gap-x-6">
                          <img
                            alt=""
                            src="https://avatars.githubusercontent.com/u/6657673?v=4"
                            className="size-14 rounded-full bg-slate-50"
                          />
                          <div className="text-base">
                            <div className="font-semibold">Sid Govindaraju</div>
                            <div className="mt-1">Engineering Manager, UKG</div>
                          </div>
                        </figcaption>
                      </figure>
                    </div>
                    <div className="grid-col-1 grid place-items-center p-4">
                      <UkgIcon aria-hidden="true" className="h-6 lg:h-12" />
                    </div>
                  </div>
                </div>
              ),
              innerButtonElement: (
                <span className="text-2xl">Proactive partnership</span>
              ),
            },
          ]}
        />
      </div>

      <VideoModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        videoUrl={currentVideo}
      />
    </section>
  );
}

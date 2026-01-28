'use client';
import { ButtonLink, SectionHeading, Strong } from '@nx/nx-dev-ui-common';
import { ReactElement, useState, useEffect } from 'react';
import { Dialog, DialogPanel, Transition } from '@headlessui/react';
import Link from 'next/link';

const MOBILE_BREAKPOINT = 768;
const YOUTUBE_URL = 'https://youtu.be/KZ0nh2lj8zE?si=D1hkyP3vy36e-VZt';

export function Hero(): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const checkMobile = () =>
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleVideoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isMobile) {
      window.open(YOUTUBE_URL, '_blank');
    } else {
      setIsOpen(true);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <SectionHeading as="h1" variant="display">
          Nx Powerpack
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6 text-center">
          A suite of extensions for the Nx CLI{' '}
          <Strong>specifically designed for enterprises</Strong>, built and
          supported by the Nx core team.
        </SectionHeading>
        <p className="mt-6 text-sm italic">
          Nx Powerpack is included in Nx Enterprise.
          <br />
          <Link
            href="/enterprise/trial"
            prefetch={false}
            className="font-semibold underline"
          >
            Request a free trial of Nx Enterprise
          </Link>
        </p>
      </div>

      {!isMobile && (
        <Dialog
          as="div"
          open={isOpen}
          onClose={() => setIsOpen(false)}
          className="relative z-10"
        >
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <DialogPanel className="relative w-auto transform overflow-hidden rounded-2xl border border-zinc-950 bg-zinc-950 text-left align-middle shadow-xl transition-all focus:outline-none">
                <iframe
                  width="812"
                  height="456"
                  src="https://www.youtube.com/embed/KZ0nh2lj8zE?si=D1hkyP3vy36e-VZt"
                  title="Introducing Nx Powerpack"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="max-w-full"
                />
              </DialogPanel>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

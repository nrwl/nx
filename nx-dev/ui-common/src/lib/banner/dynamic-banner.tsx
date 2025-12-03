'use client';

import { MouseEvent, ReactElement, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  MegaphoneIcon,
  VideoCameraIcon,
  XMarkIcon,
  PlayIcon,
  ChatBubbleLeftRightIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { useBannerConfig } from './use-banner-config';
import {
  BannerNotification,
  BannerLink,
  getDefaultCtaText,
} from './banner.types';

export interface DynamicBannerProps {
  bannerUrl?: string;
}

/**
 * Dynamic banner component that fetches banner config from a URL
 * and displays the active notification
 */
export function DynamicBanner({
  bannerUrl,
}: DynamicBannerProps): ReactElement | null {
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const { activeBanner, isLoading } = useBannerConfig(bannerUrl);

  console.log('>>>>>>>>>>>>>>>>>>', bannerUrl);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (activeBanner) {
      const localStorageKey = `banner-${activeBanner.id}-closed`;
      const isClosedSession = localStorage.getItem(localStorageKey);
      if (isClosedSession === 'true') {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
    }
  }, [activeBanner]);

  const closeNotifier = (e: MouseEvent) => {
    e.stopPropagation();
    setIsVisible(false);
    if (activeBanner) {
      localStorage.setItem(`banner-${activeBanner.id}-closed`, 'true');
    }
  };

  if (!isMounted || !isVisible || isLoading || !activeBanner) {
    return null;
  }

  const ctaText = activeBanner.ctaText || getDefaultCtaText(activeBanner.type);

  return (
    <motion.div
      layout
      initial={{ y: '120%' }}
      animate={{ y: 0 }}
      exit={{ y: '120%' }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 30,
        mass: 1,
      }}
      className="fixed bottom-0 left-0 right-0 z-30 w-full overflow-hidden bg-slate-950 text-white shadow-lg md:bottom-4 md:left-auto md:right-4 md:w-[512px] md:rounded-lg"
      style={{ originY: 1 }}
    >
      <div className="relative p-4">
        <button
          onClick={closeNotifier}
          className="absolute right-2 top-2 flex h-9 w-9 cursor-pointer items-center justify-center !rounded-full bg-transparent p-1 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-white"
        >
          <XMarkIcon className="size-5" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </button>
        <div>
          <motion.h3
            layout="position"
            className="flex items-center gap-2 pr-8 text-lg font-semibold"
          >
            <BannerIcon type={activeBanner.type} />
            <span>{activeBanner.title}</span>
          </motion.h3>
          <motion.div key="banner-content" className="mt-4 space-y-4">
            <p className="mb-2 text-sm">{activeBanner.description}</p>
            <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-4">
              {activeBanner.links?.map((link, index) => (
                <BannerLinkButton key={index} link={link} />
              ))}
              <a
                title={ctaText}
                href={activeBanner.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-pink-600 px-2 py-2 text-sm font-semibold text-white no-underline transition hover:bg-pink-700 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 active:text-black/70 md:px-4"
              >
                <BannerCtaIcon type={activeBanner.type} />
                <span>{ctaText}</span>
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function BannerIcon({
  type,
}: {
  type: BannerNotification['type'];
}): ReactElement {
  switch (type) {
    case 'webinar':
      return (
        <VideoCameraIcon aria-hidden="true" className="size-8 flex-shrink-0" />
      );
    case 'event':
      return (
        <MegaphoneIcon aria-hidden="true" className="size-8 flex-shrink-0" />
      );
    case 'release':
      return (
        <MegaphoneIcon aria-hidden="true" className="size-8 flex-shrink-0" />
      );
  }
}

function BannerCtaIcon({
  type,
}: {
  type: BannerNotification['type'];
}): ReactElement {
  switch (type) {
    case 'webinar':
      return <VideoCameraIcon aria-hidden="true" className="size-4" />;
    case 'event':
      return (
        <ArrowTopRightOnSquareIcon aria-hidden="true" className="size-4" />
      );
    case 'release':
      return (
        <ArrowTopRightOnSquareIcon aria-hidden="true" className="size-4" />
      );
  }
}

function BannerLinkButton({ link }: { link: BannerLink }): ReactElement {
  const getLinkIcon = () => {
    switch (link.icon) {
      case 'play':
        return <PlayIcon aria-hidden="true" className="size-4" />;
      case 'chat':
        return (
          <ChatBubbleLeftRightIcon aria-hidden="true" className="size-4" />
        );
      case 'external':
        return (
          <ArrowTopRightOnSquareIcon aria-hidden="true" className="size-4" />
        );
      default:
        return null;
    }
  };

  return (
    <a
      href={link.url}
      target="_blank"
      title={link.label}
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-sm font-semibold text-white no-underline transition hover:bg-slate-700 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 md:px-4"
    >
      {getLinkIcon()}
      <span>{link.label}</span>
    </a>
  );
}

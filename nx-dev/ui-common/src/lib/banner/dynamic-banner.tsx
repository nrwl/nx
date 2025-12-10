'use client';

import { ReactElement } from 'react';
import { useBannerConfig } from './use-banner-config';
import { WebinarNotifier } from '../webinar-notifier';

export interface DynamicBannerProps {
  bannerUrl?: string;
}

/**
 * Dynamic banner component that fetches banner config from a URL
 * and renders WebinarNotifier with the fetched props
 */
export function DynamicBanner({
  bannerUrl,
}: DynamicBannerProps): ReactElement | null {
  const { banner, isLoading } = useBannerConfig(bannerUrl);

  if (isLoading || !banner || !banner.enabled) {
    return null;
  }

  return (
    <WebinarNotifier
      title={banner.title}
      description={banner.description}
      primaryCtaUrl={banner.primaryCtaUrl}
      primaryCtaText={banner.primaryCtaText}
      secondaryCtaUrl={banner.secondaryCtaUrl}
      secondaryCtaText={banner.secondaryCtaText}
    />
  );
}

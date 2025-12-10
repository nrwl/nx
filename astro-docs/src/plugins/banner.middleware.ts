import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { getCollection } from 'astro:content';

export interface BannerConfig {
  id: string;
  title: string;
  description: string;
  primaryCtaUrl: string;
  primaryCtaText: string;
  secondaryCtaUrl?: string;
  secondaryCtaText?: string;
  enabled: boolean;
}

let cachedBannerPromise: Promise<BannerConfig | null> | null = null;

async function getBannerConfig(): Promise<BannerConfig | null> {
  if (cachedBannerPromise !== null) {
    return cachedBannerPromise;
  }

  cachedBannerPromise = (async () => {
    const bannerUrl = import.meta.env.BANNER_URL;

    // If URL is set, fetch from remote
    if (bannerUrl) {
      try {
        const response = await fetch(bannerUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return (await response.json()) as BannerConfig;
      } catch (error) {
        console.warn('Failed to fetch banner config:', error);
        // Fall through to use committed config
      }
    }

    // Use committed banner-config.json via content collection
    const bannerCollection = await getCollection('banner');
    if (bannerCollection.length > 0) {
      return bannerCollection[0].data as BannerConfig;
    }

    return null;
  })();

  return cachedBannerPromise;
}

export const onRequest = defineRouteMiddleware(async (context) => {
  const bannerConfig = await getBannerConfig();

  if (!bannerConfig) {
    return;
  }

  // Set floating banner config for WebinarNotifier component
  context.locals.floatingBanner = bannerConfig;

  // Set Starlight top banner (unless page already has one)
  const { entry } = context.locals.starlightRoute;
  if (!entry.data.banner && bannerConfig.enabled) {
    entry.data.banner = {
      content: `<a href="${bannerConfig.primaryCtaUrl}" title="${bannerConfig.title}">${bannerConfig.title}</a>`,
    };
  }
});

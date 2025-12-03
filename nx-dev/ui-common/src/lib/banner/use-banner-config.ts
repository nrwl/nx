'use client';

import { useState, useEffect } from 'react';
import {
  BannerConfig,
  BannerNotification,
  getActiveBanner,
} from './banner.types';

interface UseBannerConfigResult {
  config: BannerConfig | null;
  activeBanner: BannerNotification | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch and manage banner configuration from a URL
 * @param bannerUrl - URL to fetch banner JSON from
 * @returns Banner config, active banner, loading state, and any errors
 */
export function useBannerConfig(
  bannerUrl: string | undefined
): UseBannerConfigResult {
  const [config, setConfig] = useState<BannerConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchConfig() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(bannerUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch banner config: ${response.status}`);
        }
        const data: BannerConfig = await response.json();
        if (!cancelled) {
          setConfig(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    if (bannerUrl) {
      fetchConfig();
    }

    return () => {
      cancelled = true;
    };
  }, [bannerUrl]);

  return {
    config,
    activeBanner: getActiveBanner(config),
    isLoading,
    error,
  };
}

'use client';
import { useEffect, useRef } from 'react';
import {
  getWebInstrumentations,
  initializeFaro,
  faro,
} from '@grafana/faro-web-sdk';
import {
  NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  NEXT_PUBLIC_FARO_URL,
  NEXT_PUBLIC_VERCEL_ENV,
} from 'astro:env/client';

export function FrontendObservability() {
  const initialized = useRef(false);
  useEffect(() => {
    const version = NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
    const url = NEXT_PUBLIC_FARO_URL;
    // Don't initialize if we're not in a deployed environment, e.g. local development
    if (initialized.current || !version) return;
    initialized.current = true;
    const vercelEnv = NEXT_PUBLIC_VERCEL_ENV;
    const environment =
      vercelEnv === 'production'
        ? 'prod'
        : vercelEnv === 'preview'
        ? 'staging'
        : 'development';
    if (faro.api) {
      faro.api.setPage({ url: document.location.href });
    } else {
      initializeFaro({
        url,
        app: {
          name: 'Nx Dev',
          version,
          environment,
        },
        instrumentations: [...getWebInstrumentations()],
      });
    }
  }, []);
  return null;
}

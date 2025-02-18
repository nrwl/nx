'use client';
import { useEffect, useRef } from 'react';
import { getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk';

export function FrontendObservability() {
  const initialized = useRef(false);
  useEffect(() => {
    const version = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
    const url = process.env.NEXT_PUBLIC_FARO_URL;
    // Don't initialize if we're not in a deployed environment, e.g. local development
    if (!process['browser'] || initialized.current || !version) return;
    initialized.current = true;
    const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
    const environment =
      vercelEnv === 'production'
        ? 'prod'
        : vercelEnv === 'preview'
        ? 'staging'
        : 'development';
    initializeFaro({
      url,
      app: {
        name: 'Nx Dev',
        version,
        environment,
      },
      instrumentations: [...getWebInstrumentations()],
    });
  }, []);
  return null;
}

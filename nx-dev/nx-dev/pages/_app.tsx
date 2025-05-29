import { sendPageViewEvent } from '@nx/nx-dev/feature-analytics';
import { DefaultSeo } from 'next-seo';
import { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Script from 'next/script';
import { useEffect } from 'react';
import '../styles/main.css';
import Link from 'next/link';
import { WebinarNotifier } from '@nx/nx-dev/ui-common';
import { FrontendObservability } from '../lib/components/frontend-observability';
import GlobalScripts from '../app/global-scripts';

export default function CustomApp({
  Component,
  pageProps,
}: AppProps): JSX.Element {
  const router = useRouter();
  const gaMeasurementId = 'UA-88380372-10';
  const gtmMeasurementId = 'GTM-KW8423B6';

  useEffect(() => {
    const handleRouteChange = (url: URL) =>
      sendPageViewEvent({ gaId: gaMeasurementId, path: url.toString() });
    router.events.on('routeChangeStart', (url) => handleRouteChange(url));
    return () => router.events.off('routeChangeStart', handleRouteChange);
  }, [router.events, gaMeasurementId]);
  return (
    <>
      <FrontendObservability />
      <DefaultSeo
        title="Nx: Smart Repos · Fast Builds"
        description="Build system, optimized for monorepos, with AI-powered architectural awareness and advanced CI capabilities."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx: Smart Repos · Fast Builds',
          description:
            'Build system, optimized for monorepos, with AI-powered architectural awareness and advanced CI capabilities.',
          images: [
            {
              url: 'https://nx.dev/images/nx-media.jpg',
              width: 800,
              height: 421,
              alt: 'Nx: Smart Repos · Fast Builds',
              type: 'image/jpeg',
            },
          ],
          siteName: 'Nx',
          type: 'website',
        }}
        twitter={{
          site: '@nxdevtools',
          cardType: 'summary_large_image',
        }}
        dangerouslySetAllPagesToNoIndex={
          process.env.NEXT_PUBLIC_NO_INDEX === 'true'
        }
        canonical={'https://nx.dev' + router.asPath.split('?')[0]}
      />
      <Head>
        <meta name="apple-mobile-web-app-title" content="Nx" />
        <meta name="application-name" content="Nx" />
        <meta
          name="msapplication-TileColor"
          content="#DA532C"
          key="windows-tile-color"
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content="#F8FAFC"
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content="#0F172A"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Link
        id="skip-to-content-link"
        href="#main"
        tabIndex={0}
        className="absolute left-8 top-3 -translate-y-24 rounded-md bg-green-400 px-4 py-2 text-white transition focus:translate-y-0"
      >
        Skip to content
      </Link>
      <Component {...pageProps} />
      {/* <LiveStreamNotifier /> */}
      <WebinarNotifier />

      {/* All tracking scripts consolidated in GlobalScripts component */}
      <GlobalScripts
        gaMeasurementId={gaMeasurementId}
        gtmMeasurementId={gtmMeasurementId}
      />
    </>
  );
}

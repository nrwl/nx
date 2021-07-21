import React, { useEffect } from 'react';
import { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { sendPageViewEvent } from '@nrwl/nx-dev/feature-analytics';
import '../styles/main.css';

export default function CustomApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const gaMeasurementId = 'UA-88380372-10';
  useEffect(() => {
    const handleRouteChange = (url: URL) =>
      sendPageViewEvent({ gaId: gaMeasurementId, path: url.toString() });
    router.events.on('routeChangeStart', (url) => handleRouteChange(url));
    return () => router.events.off('routeChangeStart', handleRouteChange);
  }, [router]);
  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@nxdevtools" />
        <meta name="twitter:creator" content="@nrwl_io" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/images/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/images/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/images/favicon-16x16.png"
        />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link
          rel="mask-icon"
          href="/images/safari-pinned-tab.svg"
          color="#5bbad5"
        />
        <meta name="msapplication-TileColor" content="#da532c" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Global Site Tag (gtag.js) - Google Analytics */}
        <script
          async
          defer
          src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){ dataLayer.push(arguments); }
            gtag('js', new Date());
            gtag('config', '${gaMeasurementId}', {
              page_path: window.location.pathname,
            });
          `,
          }}
        />
        {/* HubSpot Analytics */}
        <script
          id="hs-script-loader"
          async
          defer
          src="https://js.hs-scripts.com/2757427.js"
        />
      </Head>
      <div className="documentation-app text-gray-700 antialiased bg-white">
        <Component {...pageProps} />
      </div>
    </>
  );
}

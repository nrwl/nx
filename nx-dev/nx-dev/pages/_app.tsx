import React, { useEffect } from 'react';
import { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { DefaultSeo } from 'next-seo';
import { sendPageViewEvent } from '@nrwl/nx-dev/feature-analytics';
import '../styles/main.css';
import Script from 'next/script';

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
      <DefaultSeo
        title="Nx: Smart, Fast and Extensible Build System"
        description="Next generation build system with first class monorepo support and powerful integrations."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx: Smart, Fast and Extensible Build System',
          description:
            'Next generation build system with first class monorepo support and powerful integrations.',
          images: [
            {
              url: 'https://nx.dev/images/nx-media.jpg',
              width: 800,
              height: 400,
              alt: 'Nx: Smart, Fast and Extensible Build System',
              type: 'image/jpeg',
            },
          ],
          site_name: 'Nx',
        }}
        twitter={{
          handle: '@nrwl_io',
          site: '@nxdevtools',
          cardType: 'summary_large_image',
        }}
      />
      <Head>
        <meta charSet="utf-8" />
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
      </Head>
      <div className="documentation-app text-gray-700 antialiased bg-white">
        <Component {...pageProps} />
      </div>
      {/* Global Site Tag (gtag.js) - Google Analytics */}
      <Script
        id="gtag-script-dependency"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
      />
      <Script
        id="gtag-script-loader"
        strategy="afterInteractive"
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
      <Script
        id="hs-script-loader"
        strategy="lazyOnload"
        src="https://js.hs-scripts.com/2757427.js"
      />
      {/* Hotjar Analytics */}
      <Script
        id="hotjar-script-loader"
        strategy="lazyOnload"
        dangerouslySetInnerHTML={{
          __html: `
          (function(h,o,t,j,a,r){
          h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
          h._hjSettings={hjid:2774127,hjsv:6};
          a=o.getElementsByTagName('head')[0];
          r=o.createElement('script');r.async=1;
          r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
          a.appendChild(r);
        })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`,
        }}
      />
    </>
  );
}

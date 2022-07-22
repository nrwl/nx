import { sendPageViewEvent } from '@nrwl/nx-dev/feature-analytics';
import { DefaultSeo } from 'next-seo';
import { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Script from 'next/script';
import { useEffect } from 'react';
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
        <meta name="msapplication-TileColor" content="#da532c" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <a
        id="skip-to-content-link"
        href="#main"
        tabIndex={0}
        className="bg-green-nx-base absolute top-3 left-8 -translate-y-24 rounded-md px-4 py-2 text-white transition focus:translate-y-0"
      >
        Skip to content
      </a>
      <div className="documentation-app bg-white text-gray-700 antialiased">
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
        strategy="worker"
        src="https://js.hs-scripts.com/2757427.js"
      />
      {/* Hotjar Analytics */}
      <Script
        id="hotjar-script-loader"
        strategy="afterInteractive"
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

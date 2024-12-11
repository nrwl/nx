import { sendPageViewEvent } from '@nx/nx-dev/feature-analytics';
import { DefaultSeo } from 'next-seo';
import { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Script from 'next/script';
import { useEffect } from 'react';
import '../styles/main.css';
import Link from 'next/link';
import { LiveStreamNotifier, WebinarNotifier } from '@nx/nx-dev/ui-common';

export default function CustomApp({
  Component,
  pageProps,
}: AppProps): JSX.Element {
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
        title="Nx: Smart Monorepos · Fast CI"
        description="Nx is a build system, optimized for monorepos, with plugins for popular frameworks and tools and advanced CI capabilities including caching and distribution."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx: Smart Monorepos · Fast CI',
          description:
            'Nx is a build system, optimized for monorepos, with plugins for popular frameworks and tools and advanced CI capabilities including caching and distribution.',
          images: [
            {
              url: 'https://nx.dev/images/nx-media.jpg',
              width: 800,
              height: 421,
              alt: 'Nx: Smart Monorepos · Fast CI',
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
      {/*<WebinarNotifier />*/}

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
      {/* Apollo.io Embed Code */}
      <Script
        type="text/javascript"
        id="apollo-script-loader"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `function initApollo(){var n=Math.random().toString(36).substring(7),o=document.createElement("script"); o.src="https://assets.apollo.io/micro/website-tracker/tracker.iife.js?nocache="+n,o.async=!0,o.defer=!0,o.onload=function(){window.trackingFunctions.onLoad({appId:"65e1db2f1976f30300fd8b26"})},document.head.appendChild(o)}initApollo();`,
        }}
      />
      {/* HubSpot Analytics */}
      <Script
        id="hs-script-loader"
        strategy="afterInteractive"
        src="https://js.hs-scripts.com/2757427.js"
      />
      {/* HubSpot FORMS Embed Code */}
      <Script
        type="text/javascript"
        id="hs-forms-script-loader"
        strategy="afterInteractive"
        src="//js.hsforms.net/forms/v2.js"
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
      <Script
        id="twitter-campain-pixelcode"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
        !function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);
        },s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
        a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
        twq('config','obtp4'); 
        `,
        }}
      />
      <Script
        id="rb2b-script-loader"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
        !function () {var reb2b = window.reb2b = window.reb2b || [];if (reb2b.invoked) return;reb2b.invoked = true;reb2b.methods = ["identify", "collect"];reb2b.factory = function (method) {return function () {var args = Array.prototype.slice.call(arguments);args.unshift(method);reb2b.push(args);return reb2b;};};for (var i = 0; i < reb2b.methods.length; i++) {var key = reb2b.methods[i];reb2b[key] = reb2b.factory(key);}reb2b.load = function (key) {var script = document.createElement("script");script.type = "text/javascript";script.async = true;script.src = "https://s3-us-west-2.amazonaws.com/b2bjsstore/b/" + key + "/0NW1GH7YJ4O4.js.gz";var first = document.getElementsByTagName("script")[0];first.parentNode.insertBefore(script, first);};reb2b.SNIPPET_VERSION = "1.0.1";reb2b.load("0NW1GH7YJ4O4");}();
        `,
        }}
      />
    </>
  );
}

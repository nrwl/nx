import Script from 'next/script';

export default function GlobalScripts({ gaMeasurementId }) {
  return (
    <>
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
    </>
  );
}

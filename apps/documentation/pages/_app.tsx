import React from 'react';
import { AppProps } from 'next/app';
import Head from 'next/head';
import { DocumentationUiHeader } from '@nrwl/documentation/ui/header';
import './styles.css';

function CustomApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        {/* ONLY TEMPORARY */}
        <link
          href="https://unpkg.com/tailwindcss@^2/dist/tailwind.min.css"
          rel="stylesheet"
        />
        <title>Welcome to documentation!</title>
      </Head>
      <div className="documentation-app">
        <header
          className={
            'sticky top-0 z-40 lg:z-50 w-full max-w-8xl mx-auto bg-white flex-none flex'
          }
        >
          <DocumentationUiHeader />
        </header>
        <main>
          <Component {...pageProps} />
        </main>
      </div>
    </>
  );
}

export default CustomApp;

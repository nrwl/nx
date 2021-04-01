import React from 'react';
import { AppProps } from 'next/app';
import Head from 'next/head';
import { Header, Footer } from '@nrwl/nx-dev/ui/common';
import './styles.css';

export default function CustomApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        {/* ONLY TEMPORARY */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/tailwindcss@^2.0/dist/base.min.css"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/tailwindcss@^2.0/dist/components.min.css"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/@tailwindcss/typography@0.3.x/dist/typography.min.css"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/tailwindcss@^2.0/dist/utilities.min.css"
        />
        <title>Welcome to documentation!</title>
      </Head>
      <div className="documentation-app text-gray-500 antialiased bg-white">
        <Header />
        <main>
          <Component {...pageProps} />
        </main>
      </div>
      <Footer />
    </>
  );
}

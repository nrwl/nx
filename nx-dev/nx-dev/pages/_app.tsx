import React from 'react';
import { AppProps } from 'next/app';
import Head from 'next/head';
import { Header, Footer } from '@nrwl/nx-dev/ui/common';
import 'tailwindcss/tailwind.css';
import './styles.css';

export default function CustomApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Nx documentation</title>
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

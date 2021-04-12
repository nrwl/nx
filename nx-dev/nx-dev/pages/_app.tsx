import React from 'react';
import { AppProps } from 'next/app';
import Head from 'next/head';
import { Header, Footer } from '@nrwl/nx-dev/ui/common';
import 'tailwindcss/tailwind.css';

export default function CustomApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
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

import { DefaultSeo } from 'next-seo';
import { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import '../styles/main.css';
import Link from 'next/link';

export default function CustomApp({
  Component,
  pageProps,
}: AppProps): JSX.Element {
  const router = useRouter();
  return (
    <>
      <DefaultSeo
        title="Nx: Smart Monorepos · Fast Builds"
        description="Get to green PRs in half the time. Nx optimizes your builds, scales your CI, and fixes failed PRs. Built for developers and AI agents."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx: Smart Monorepos · Fast Builds',
          description:
            'Get to green PRs in half the time. Nx optimizes your builds, scales your CI, and fixes failed PRs. Built for developers and AI agents.',
          images: [
            {
              url: 'https://nx.dev/socials/nx-media.png',
              width: 800,
              height: 421,
              alt: 'Nx: Smart Monorepos · Fast Builds',
              type: 'image/png',
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
    </>
  );
}

import { sendCustomEvent } from '@nx/nx-dev/feature-analytics';
import { Footer, Header } from '@nx/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export function FourOhFour(): JSX.Element {
  const router = useRouter();
  const illustrationUrl = (function (): string {
    const urls = [
      '/images/illustrations/404-1.svg',
      '/images/illustrations/404-2.svg',
      '/images/illustrations/404-3.svg',
      '/images/illustrations/404-4.svg',
    ];
    return urls[Math.floor(Math.random() * urls.length)];
  })();
  useEffect(() => {
    const handleRouteChange = (url: URL) =>
      sendCustomEvent('custom_page_view', '404', url.toString());
    router.events.on('routeChangeStart', (url) => handleRouteChange(url));
    return () => router.events.off('routeChangeStart', handleRouteChange);
  }, [router]);

  return (
    <>
      <NextSeo title="Page not found" noindex={true} />
      <Header />
      <main id="main" role="main">
        <div className="w-full">
          <article
            id="getting-started"
            className="relative py-16 sm:pt-24 lg:py-32"
          >
            <div className="mx-auto px-4 sm:px-6 lg:px-8 xl:max-w-7xl">
              <div className="w-full lg:flex lg:items-center">
                <Image
                  aria-hidden="true"
                  height={200}
                  width={140}
                  loading="lazy"
                  alt="404 illustration"
                  src={illustrationUrl}
                  className="drop-shadow"
                />
                <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-6xl lg:ml-8">
                  <span className="sr-only">404 - </span>Page not found!
                </h1>
              </div>
              <p className="mt-8 text-lg">
                Sorry, but the page you were looking for could not be found.
              </p>
              <p className="mt-2 text-lg">
                You can return to{' '}
                <Link
                  href="/"
                  title="Go to the home page"
                  className="font-semibold underline"
                >
                  our front page
                </Link>
                , or{' '}
                <Link
                  href="https://github.com/nrwl/nx/issues/new?assignees=&labels=type%3A+docs&template=3-documentation.md"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline"
                  title="Create a GitHub issue"
                >
                  drop us a line
                </Link>{' '}
                if you can't find what you're looking for.
              </p>
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default FourOhFour;

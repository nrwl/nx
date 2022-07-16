import { Footer, Header } from '@nrwl/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import Link from 'next/link';

export function FourOhFour(): JSX.Element {
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
              <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-gray-800 sm:text-6xl">
                404 - Page not found!
              </h1>
              <p className="mt-8 text-lg">
                Sorry, but the page you were looking for could not be found.
              </p>
              <p className="mt-2 text-lg">
                You can return to{' '}
                <Link href="/">
                  <a
                    title="Go to the home page"
                    className="font-semibold underline"
                  >
                    our front page
                  </a>
                </Link>
                , or{' '}
                <Link href="https://github.com/nrwl/nx/issues/new?assignees=&labels=type%3A+docs&template=3-documentation.md">
                  <a
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold underline"
                    title="Create a Github issue"
                  >
                    drop us a line
                  </a>
                </Link>{' '}
                if you can't find what you're looking for.
              </p>
            </div>
          </article>
        </div>
      </main>
      <Footer useDarkBackground={false} />
    </>
  );
}

export default FourOhFour;

import { Footer, Header } from '@nx/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import Image from 'next/image';
import Link from 'next/link';

export default function FiveOhOh(): JSX.Element {
  return (
    <>
      <NextSeo title="Internal Server Error" noindex={true} />
      <Header />
      <main id="main" role="main">
        <div className="w-full">
          <article className="relative py-16 sm:pt-24 lg:py-32">
            <div className="mx-auto px-4 sm:px-6 lg:px-8 xl:max-w-7xl">
              <div className="w-full lg:flex lg:items-center">
                <Image
                  aria-hidden="true"
                  height={200}
                  width={140}
                  loading="lazy"
                  alt="500 illustration"
                  src="/images/illustrations/500.svg"
                  className="drop-shadow"
                />
                <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-6xl lg:ml-8">
                  <div className="sr-only">500 - </div>Internal Server Error!
                </h1>
              </div>
              <p className="mt-8 text-lg">
                Sorry, an error occurred while we were loading this page.
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

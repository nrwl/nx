'use client';
import { DefaultLayout, SectionHeading } from '@nx/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { contactButton } from '../lib/components/headerCtaConfigs';

import { cx } from '@nx/nx-dev/ui-primitives';
import { Framework, frameworkIcons } from '@nx/graph/legacy/icons';

export default function Tutorials(): JSX.Element {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Nx Tutorials"
        description="Get started with Nx by following along with one of these tutorials"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx Tutorials',
          description:
            'Get started with Nx by following along with one of these tutorials',
          images: [
            {
              url: 'https://nx.dev/socials/nx-media.png',
              width: 800,
              height: 421,
              alt: 'Nx: Smart Repos · Fast Builds',
              type: 'image/jpeg',
            },
          ],
          siteName: 'Nx',
          type: 'website',
        }}
      />
      <DefaultLayout headerCTAConfig={[contactButton]}>
        <section>
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              <SectionHeading
                as="h1"
                variant="display"
                className="pt-4 text-4xl sm:text-5xl md:text-6xl"
              >
                Nx Tutorials
              </SectionHeading>
              <SectionHeading
                as="p"
                variant="subtitle"
                className="mt-6 text-center sm:text-lg"
              >
                Get started with Nx by following along with one of these
                tutorials.
              </SectionHeading>
            </div>
          </div>
        </section>
        <section className="mt-16">
          <div className="col-span-2 border-y border-slate-200 bg-slate-50 px-6 py-8 md:col-span-4 lg:py-16 dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto max-w-7xl text-center">
              <dl className="grid grid-cols-1 justify-between gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                <TutorialCard
                  title="TypeScript Monorepo"
                  type="Tutorial"
                  url="/tutorials/1-ts-packages/1-introduction/1-welcome"
                  icon="jsMono"
                />
                <TutorialCard
                  title="React Monorepo"
                  type="Tutorial"
                  url="/tutorials/2-react-monorepo/1r-introduction/1-welcome"
                  icon="reactMono"
                />
                <TutorialCard
                  title="Angular Monorepo"
                  type="Tutorial"
                  url="/tutorials/3-angular-monorepo/1a-introduction/1-welcome"
                  icon="angularMono"
                />
                <TutorialCard
                  title="Gradle Monorepo"
                  type="Tutorial"
                  url="/getting-started/tutorials/gradle-tutorial"
                  icon="gradle"
                />
              </dl>
            </div>
          </div>
        </section>
      </DefaultLayout>
    </>
  );
}

function TutorialCard({
  title,
  type,
  icon,
  url,
}: {
  title: string;
  type: string;
  icon: string; // Can be either a component name or a direct image URL
  url: string;
}) {
  return (
    <a
      key={title}
      href={url}
      className="no-prose relative col-span-1 mx-auto flex w-full max-w-md flex-col items-center rounded-md border border-slate-200 bg-slate-50/40 p-4 text-center font-semibold shadow-sm transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 hover:bg-slate-100 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:bg-slate-800"
      style={{ textDecorationLine: 'none' }}
    >
      {icon && (
        <div className="mb-2 flex h-24 w-24 items-center justify-center rounded-lg">
          {icon.startsWith('/') ? (
            <img
              src={icon}
              alt={title}
              className="h-full w-full object-contain"
            />
          ) : (
            frameworkIcons[icon as Framework]?.image
          )}
        </div>
      )}
      <div className={cx({ 'pt-4': !!icon })}>
        <div className="mb-1 text-xs font-medium uppercase text-slate-600 dark:text-slate-300">
          {type}
        </div>
        <h3 className="m-0 text-lg font-semibold text-slate-900 dark:text-white">
          {title}
        </h3>
      </div>
    </a>
  );
}

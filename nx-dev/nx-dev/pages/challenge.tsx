import {
  FlipCard,
  FlipCardBack,
  FlipCardBackYoutube,
  Footer,
  Header,
  SectionHeading,
} from '@nx/nx-dev/ui-common';
import { YouTube } from '@nx/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Community(): JSX.Element {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Nx Community"
        description="There are many ways you can connect with the open-source Nx community. The community is rich and dynamic offering Nx plugins and help on multiple platforms like GitHub, Discord and Twitter"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx Community',
          description:
            'There are many ways you can connect with the open-source Nx community. The community is rich and dynamic offering Nx plugins and help on multiple platforms like GitHub, Discord and Twitter',
          images: [
            {
              url: 'https://nx.dev/socials/nx-media.png',
              width: 800,
              height: 421,
              alt: 'Nx: Smart, Fast and Extensible Build System',
              type: 'image/jpeg',
            },
          ],
          siteName: 'NxDev',
          type: 'website',
        }}
      />
      <Header />
      <main id="main" role="main">
        <div className="w-full">
          <div
            id="connect-with-us"
            className="py-18 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
          >
            <article id="nx-new-year-challenge" className="relative">
              <SectionHeading as="h1" variant="display" className="my-4">
                Nx New Year Challenge
              </SectionHeading>
              <p>
                Each day, during the first two weeks of January, a new card will
                be unlocked for you to flip.
              </p>

              <div className="mx-auto items-stretch py-12 grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-5 lg:py-16">
                <FlipCard isFlippable={true} text="1" link="#january1">
                  <FlipCardBackYoutube
                    src="https://www.youtube.com/watch?v=-_4WMl-Fn0w"
                    title="Soo...what is Nx?"
                  ></FlipCardBackYoutube>
                </FlipCard>
                <FlipCard isFlippable={false} text="2" link="#january2">
                  <FlipCardBackYoutube
                    src="https://www.youtube.com/watch?v=ArmERpNvC8Y"
                    title="Package based vs Integrated Style - Use Nx however it works best for you"
                  ></FlipCardBackYoutube>
                </FlipCard>
                <FlipCard isFlippable={true} text="3" link="#january2">
                  <FlipCardBackYoutube
                    src="https://www.youtube.com/watch?v=NZF0ZJpgaJM"
                    title="What is Nx Cloud?"
                  ></FlipCardBackYoutube>
                </FlipCard>
                <FlipCard isFlippable={true} text="4" link="#january2">
                  <FlipCardBack>
                    <h3 className="text-center">
                      Add Nx to an Existing Project
                    </h3>
                  </FlipCardBack>
                </FlipCard>
                <FlipCard isFlippable={true} text="5" link="#january2">
                  <FlipCardBackYoutube
                    src="https://www.youtube.com/watch?v=dotA6ZSmNL4"
                    title="Superpowered Micro Frontends with Monorepos"
                  ></FlipCardBackYoutube>
                </FlipCard>
                <FlipCard isFlippable={true} text="8" link="#january2">
                  <FlipCardBack>
                    <h3 className="text-center">Explore Example Repos</h3>
                  </FlipCardBack>
                </FlipCard>
                <FlipCard isFlippable={true} text="9" link="#january2">
                  <FlipCardBack>
                    <h3 className="text-center">Let's Build a CLI</h3>
                  </FlipCardBack>
                </FlipCard>
                <FlipCard isFlippable={true} text="10" link="#january2">
                  <FlipCardBack>
                    <h3 className="text-center">Optimizing Your CI/CD</h3>
                  </FlipCardBack>
                </FlipCard>
                <FlipCard isFlippable={true} text="11" link="#january2">
                  <FlipCardBackYoutube
                    src="https://www.youtube.com/watch?v=ztNpLf2Zl-c"
                    title="Graduating Your Standalone Nx Repo To A Monorepo"
                  ></FlipCardBackYoutube>
                </FlipCard>
                <FlipCard isFlippable={true} text="12" link="#january2">
                  <FlipCardBackYoutube
                    src="https://youtu.be/Ss6MfcXi0jE"
                    title="Run Code Migrations to Update your Codebase"
                  ></FlipCardBackYoutube>
                </FlipCard>
              </div>
            </article>
          </div>
          <article className="relative bg-slate-50 py-28 dark:bg-slate-800/40">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="my-10">
                <SectionHeading as="h2" variant="title" id="january1">
                  January 1st, 2024
                </SectionHeading>
                <SectionHeading as="p" variant="display" className="mt-4">
                  What is Nx?
                </SectionHeading>
                <div className="mx-auto my-8 max-w-3xl">
                  <YouTube
                    src="https://www.youtube.com/watch?v=-_4WMl-Fn0w"
                    title="Soo...what is Nx?"
                    caption=""
                    width="100%"
                  ></YouTube>
                </div>
                <p>Here is some text about what Nx is</p>
                <p>
                  Read more in our{' '}
                  <Link
                    href="/getting-started/intro"
                    className="underline text-slate-900 dark:text-slate-100"
                  >
                    Intro to Nx
                  </Link>
                </p>
              </div>
              <div className="my-10">
                <SectionHeading as="h2" variant="title" id="january2">
                  January 2nd, 2024
                </SectionHeading>
                <SectionHeading as="p" variant="display" className="mt-4">
                  Which Style of Workspace is Right for You?
                </SectionHeading>
                <div className="mx-auto my-8 max-w-3xl">
                  <YouTube
                    src="https://www.youtube.com/watch?v=ArmERpNvC8Y"
                    title="Package based vs Integrated Style - Use Nx however it works best for you"
                    caption=""
                    width="100%"
                  ></YouTube>
                </div>
                <p>Here is some text about ways to use Nx</p>
                <p>
                  Read more in our{' '}
                  <Link
                    href="/concepts/integrated-vs-package-based"
                    className="underline text-slate-900 dark:text-slate-100"
                  >
                    Types of Repos Guide
                  </Link>
                </p>
              </div>
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}

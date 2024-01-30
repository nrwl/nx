import { Footer, Header, SectionHeading } from '@nx/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';

export default function Blog(): JSX.Element {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Nx Blog"
        description="Latest news from the Nx & Nx Cloud core team"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx Blog',
          description:
            'Stay updated with the latest news, articles, and updates from the Nx & Nx Cloud team.',
          images: [
            {
              url: 'https://nx.dev/socials/nx-media.png',
              width: 800,
              height: 421,
              alt: 'Nx: Smart Monorepos · Fast CI',
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
          <div className="py-8 bg-slate-50 dark:bg-slate-800/40">
            <article className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:items-center lg:py-4 lg:px-8">
              <header className="md:py-8">
                <div>
                  <SectionHeading as="h1" variant="display" id="blog-title">
                    The Nx Blog
                  </SectionHeading>
                  <p className="pt-5 text-lg text-slate-700 dark:text-slate-400">
                    Coming soon...
                  </p>
                </div>
              </header>
              <p className="pt-5  text-lg text-slate-700 dark:text-slate-400">
                And while we're working on getting our new shiny blog up and
                running, check out our current blog posts on Medium and Dev.to.
                Or sit back, relax and watch some of our video content on
                Youtube.
              </p>
            </article>
            <section className="mx-auto max-w-7xl px-4 pt-12 grid grid-cols-1 gap-5 md:grid-cols-3 pb-24">
              <div className="group relative rounded-lg border border-slate-200 bg-white/60 p-5 transition duration-200 ease-out hover:border-slate-300 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:border-slate-900 dark:hover:bg-slate-800">
                <div className="relative m-2 mb-6 inline-flex h-10 w-10 items-center justify-center">
                  <div className="absolute inset-0 -m-2 rotate-6 transform rounded-3xl bg-slate-300 transition duration-200 ease-out group-hover:-rotate-3 group-hover:scale-105 dark:bg-slate-800" />
                  <div className="absolute inset-0 -rotate-6 transform rounded-2xl bg-[#000000] bg-opacity-75 shadow-inner transition duration-200 ease-out group-hover:rotate-2 group-hover:scale-105" />
                  <svg
                    fill="currentColor"
                    className="relative inline-block h-5 w-5 transform text-white transition duration-200 ease-out group-hover:scale-110"
                    role="img"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <title>Medium</title>
                    <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z" />
                  </svg>
                </div>
                <h4 className="mb-2 text-lg font-bold">
                  Current, official "Nrwl" blog
                </h4>
                <a
                  href="https://blog.nrwl.io"
                  rel="noreferrer"
                  target="_blank"
                  title="Nx Blog"
                  className="focus:outline-none"
                >
                  <span className="absolute inset-0" aria-hidden="true"></span>
                  <p className="leading-relaxed">
                    Read all of the latest news on our current - soon to be
                    sunset - official Nx aka Nrwl Blog.
                  </p>
                </a>
              </div>
              <div className="group relative rounded-lg border border-slate-200 bg-white/60 p-5 transition duration-200 ease-out hover:border-indigo-300 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:border-indigo-900 dark:hover:bg-slate-800">
                <div className="relative m-2 mb-6 inline-flex h-10 w-10 items-center justify-center">
                  <div className="absolute inset-0 -m-2 rotate-6 transform rounded-3xl bg-indigo-300 transition duration-200 ease-out group-hover:-rotate-3 group-hover:scale-105 dark:bg-indigo-900" />
                  <div className="absolute inset-0 -rotate-6 transform rounded-2xl bg-[#5865F2] bg-opacity-75 shadow-inner transition duration-200 ease-out group-hover:rotate-2 group-hover:scale-105" />
                  <svg
                    role="img"
                    fill="currentColor"
                    className="relative inline-block h-5 w-5 transform text-white transition duration-200 ease-out group-hover:scale-110"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <title>dev.to</title>
                    <path d="M7.42 10.05c-.18-.16-.46-.23-.84-.23H6l.02 2.44.04 2.45.56-.02c.41 0 .63-.07.83-.26.24-.24.26-.36.26-2.2 0-1.91-.02-1.96-.29-2.18zM0 4.94v14.12h24V4.94H0zM8.56 15.3c-.44.58-1.06.77-2.53.77H4.71V8.53h1.4c1.67 0 2.16.18 2.6.9.27.43.29.6.32 2.57.05 2.23-.02 2.73-.47 3.3zm5.09-5.47h-2.47v1.77h1.52v1.28l-.72.04-.75.03v1.77l1.22.03 1.2.04v1.28h-1.6c-1.53 0-1.6-.01-1.87-.3l-.3-.28v-3.16c0-3.02.01-3.18.25-3.48.23-.31.25-.31 1.88-.31h1.64v1.3zm4.68 5.45c-.17.43-.64.79-1 .79-.18 0-.45-.15-.67-.39-.32-.32-.45-.63-.82-2.08l-.9-3.39-.45-1.67h.76c.4 0 .75.02.75.05 0 .06 1.16 4.54 1.26 4.83.04.15.32-.7.73-2.3l.66-2.52.74-.04c.4-.02.73 0 .73.04 0 .14-1.67 6.38-1.8 6.68z" />
                  </svg>
                </div>
                <h4 className="mb-2 text-lg font-bold">
                  We're on Dev.to, too!
                </h4>
                <a
                  href="https://dev.to/nx"
                  rel="noreferrer"
                  target="_blank"
                  title="Nx Blog"
                  className="focus:outline-none"
                >
                  <span className="absolute inset-0" aria-hidden="true"></span>
                  <p className="leading-relaxed">
                    You're not really into Medium? Prefer dev.to? Good news, we
                    cross-post most of our articles to a Dev.to collection.
                  </p>
                </a>
              </div>
              <div className="group relative rounded-lg border border-slate-200 bg-white/60 p-5 transition duration-200 ease-out hover:border-red-300 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:border-red-900 dark:hover:bg-slate-800">
                <div className="relative m-2 mb-6 inline-flex h-10 w-10 items-center justify-center">
                  <div className="absolute inset-0 -m-2 rotate-6 transform rounded-3xl bg-red-300 transition duration-200 ease-out group-hover:-rotate-3 group-hover:scale-105 dark:bg-red-900" />
                  <div className="absolute inset-0 -rotate-6 transform rounded-2xl bg-[#FF0000] bg-opacity-75 shadow-inner transition duration-200 ease-out group-hover:rotate-2 group-hover:scale-105" />
                  <svg
                    fill="currentColor"
                    className="hi-solid hi-chart-pie relative inline-block h-5 w-5 transform text-white transition duration-200 ease-out group-hover:scale-110"
                    role="img"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <title>YouTube</title>
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </div>
                <h4 className="mb-2 text-lg font-bold">
                  Prefer Video Content?
                </h4>
                <a
                  href="https://www.youtube.com/@NxDevtools/videos?utm_source=nx.dev"
                  rel="noreferrer"
                  target="_blank"
                  title="Nx Youtube channel"
                  className="focus:outline-none"
                >
                  <span className="absolute inset-0" aria-hidden="true"></span>
                  <p className="leading-relaxed">
                    Not into reading right now? Then go to our YT channel to
                    enjoy some short informative clips, release videos or live
                    Q&A sessions. Don't forget to subscribe while you're there!
                  </p>
                </a>
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

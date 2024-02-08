import { Footer, Header } from '@nx/nx-dev/ui-common';
import {
  LaunchWeekAgenda,
  LaunchWeekAnnouncements,
  LaunchWeekSpeakers,
  LaunchNxCommunityPartners,
  CodeOfConduct,
} from '@nx/nx-dev/ui-conference';
import { NextSeo } from 'next-seo';
import Link from 'next/link';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Transition } from '@headlessui/react';
import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

const WidgetBot = dynamic(import('@widgetbot/react-embed'), {
  ssr: false,
});

export default function ConfPage(): JSX.Element {
  const router = useRouter();
  const [chatIsOpen, setChatIsOpen] = useState(true);

  return (
    <>
      <NextSeo
        title="Launch Nx - February 5-9, 2024"
        description="Join us for Launch Nx when we’ll be announcing exciting new features and plans for Nx and Nx Cloud, culminating in a free, half-day online conference on Thursday, Feb. 8th."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Launch Nx - February 5-9, 2024',
          description:
            'Join us for Launch Nx when we’ll be announcing exciting new features and plans for Nx and Nx Cloud, culminating in a free, half-day online conference on Thursday, Feb. 8th.',
          images: [
            {
              url: 'https://nx.dev/socials/launch-nx-feb-2024.jpg',
              width: 1600,
              height: 900,
              alt: 'Launch Nx - February 5-9, 2024',
              type: 'image/jpeg',
            },
          ],
          siteName: 'NxDev',
          type: 'website',
        }}
      />
      <main id="main" role="main">
        <div
          className="w-full overflow-hidden bg-slate-50 dark:bg-slate-800/40"
          style={{
            background:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'%3E%3Crect width='2' height='2' fill='rgb(59,130,246)' fill-opacity='0.15'/%3E%3C/svg%3E\")",
          }}
        ></div>
        <div className="lg:h-screen flex flex-col">
          <Header />
          <div className="flex h-72 lg:flex-1 flex-row overflow-hidden">
            <div className="relative flex-1 transition-all">
              <iframe
                width="560"
                height="315"
                src="https://www.youtube.com/embed/fy0K2Smyj5A?si=f4dsDHO2g0XWA45x"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
                title="Nx Launch Conf Feb 2024"
                className="w-full h-full"
              ></iframe>
            </div>

            <div className="hidden lg:flex bg-[#36393e] flex-col items-center p-1">
              <button
                className="w-6 h-6"
                onClick={() => setChatIsOpen(!chatIsOpen)}
              >
                {chatIsOpen ? (
                  <ArrowRightIcon className="text-white" />
                ) : (
                  <ArrowLeftIcon className="text-white" />
                )}
              </button>
              <svg
                fill="currentColor"
                className="relative inline-block h-5 w-5 transform text-white transition duration-200 ease-out group-hover:scale-110"
                role="img"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <title>Discord</title>
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
              </svg>
            </div>

            <Transition
              show={chatIsOpen}
              enter="transition-all ease-in-out duration-300 transform"
              enterFrom="-mr-[32rem]"
              enterTo="mr-0"
              leave="transition-all ease-in-out duration-300 transform"
              leaveFrom="mr-0"
              leaveTo="-mr-[32rem]"
            >
              <div className="hidden lg:block w-[32rem] h-full bg-[#36393e]">
                <WidgetBot
                  className=" w-full h-full"
                  server="1143497901675401286"
                  channel="1203766140644495401"
                />
              </div>
            </Transition>
          </div>
          <div className="w-full p-4 ">
            <a
              href="https://go.nx.dev/community"
              rel="noreferrer"
              target="_blank"
              title="Nx Official Discord Server"
              className="focus:outline-none"
            >
              <div className="group flex gap-4 items-center rounded-lg border border-slate-200 bg-white/60 p-5 transition duration-200 ease-out hover:border-indigo-300 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:border-indigo-900 dark:hover:bg-slate-800">
                <div className="relative shrink-0 inline-flex h-10 w-10 items-center justify-center">
                  <div className="absolute inset-0 -m-2 rotate-6 transform rounded-3xl bg-indigo-300 transition duration-200 ease-out group-hover:-rotate-3 group-hover:scale-105 dark:bg-indigo-900" />
                  <div className="absolute inset-0 -rotate-6 transform rounded-2xl bg-[#5865F2] bg-opacity-75 shadow-inner transition duration-200 ease-out group-hover:rotate-2 group-hover:scale-105" />
                  <svg
                    fill="currentColor"
                    className="relative inline-block h-5 w-5 transform text-white transition duration-200 ease-out group-hover:scale-110"
                    role="img"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <title>Discord</title>
                    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
                  </svg>
                </div>
                <div className="flex flex-col gap-2 md:flex-row">
                  <h4 className="text-lg font-bold">Join us on Discord</h4>

                  <p className="leading-relaxed">
                    Join our <code>⁠launch-nx-2024</code> channel on the Nx
                    Community discord to discuss the conference.
                  </p>
                </div>
              </div>
            </a>
          </div>
          {/*NAVIGATION*/}
          <div className="hidden border-t border-b border-slate-200 dark:border-slate-700 md:block">
            <div className="mx-auto max-w-screen-lg xl:max-w-screen-xl">
              <div className="font-input-mono grid-cols-5 items-center divide-x divide-slate-200 text-center dark:divide-slate-700 md:grid">
                <div className="p-6">
                  <svg
                    className="inline-block dark:text-white"
                    role="img"
                    fill="currentColor"
                    viewBox="0 0 53.622 8.748"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M37.481 73.102h-1.036v-8.577h1.036zm6.835 0h-1.03v-.656q-.138.094-.375.265-.232.165-.452.265-.26.126-.596.21-.336.087-.788.087-.832 0-1.411-.55-.579-.552-.579-1.407 0-.7.298-1.13.303-.435.86-.683.562-.248 1.35-.336.788-.088 1.692-.133v-.16q0-.352-.126-.584-.122-.231-.353-.364-.22-.126-.53-.17-.308-.045-.644-.045-.408 0-.91.11-.501.105-1.036.31h-.055v-1.053q.303-.083.876-.182.573-.1 1.13-.1.65 0 1.13.11.485.105.838.365.347.253.53.655.181.403.181.998zm-1.03-1.515v-1.715q-.475.028-1.12.083-.639.055-1.014.16-.446.127-.722.397-.276.264-.276.733 0 .529.32.8.32.264.976.264.545 0 .997-.21.452-.215.838-.512zm8.13 1.515h-1.037v-.683q-.523.413-1.003.634-.48.22-1.058.22-.97 0-1.51-.59-.54-.595-.54-1.741v-3.997h1.036v3.506q0 .469.044.805.044.33.187.568.149.242.386.352.237.11.69.11.401 0 .876-.209.48-.21.892-.535v-4.597h1.037zm7.188 0h-1.037v-3.505q0-.425-.05-.794-.049-.375-.181-.584-.138-.232-.397-.342-.26-.116-.673-.116-.424 0-.887.21-.463.209-.887.534v4.597h-1.037v-6.157h1.037v.684q.485-.403 1.003-.629.518-.226 1.064-.226.997 0 1.521.601.524.601.524 1.731zm6.548-.385q-.518.248-.987.385-.463.138-.986.138-.667 0-1.224-.193-.557-.198-.954-.595-.402-.397-.622-1.003-.22-.607-.22-1.417 0-1.51.826-2.37.832-.86 2.194-.86.529 0 1.036.149.513.149.937.364v1.152h-.055q-.474-.37-.981-.568-.502-.199-.981-.199-.882 0-1.395.596-.507.59-.507 1.736 0 1.114.496 1.714.502.596 1.406.596.314 0 .639-.083t.584-.215q.226-.116.425-.242.198-.133.314-.226h.055zm6.477.385h-1.036v-3.505q0-.425-.05-.794-.05-.375-.182-.584-.138-.232-.397-.342-.259-.116-.672-.116-.425 0-.888.21-.463.209-.887.534v4.597H66.48v-8.577h1.036v3.104q.485-.403 1.003-.629.518-.226 1.064-.226.998 0 1.521.601.524.601.524 1.731zm11.112 0h-1.036v-3.505q0-.425-.05-.794-.05-.375-.181-.584-.138-.232-.397-.342-.26-.116-.673-.116-.424 0-.887.21-.463.209-.888.534v4.597h-1.036v-6.157h1.036v.684q.485-.403 1.004-.629.518-.226 1.063-.226.998 0 1.522.601.523.601.523 1.731zm7.326 0h-1.306l-1.748-2.364-1.758 2.364h-1.207l2.403-3.07-2.381-3.087h1.306l1.737 2.326 1.741-2.326h1.213l-2.42 3.032z"
                      transform="translate(-36.445 -64.525)"
                    />
                  </svg>
                </div>
                <Link
                  href="#announcements"
                  className="cursor-pointer bg-white/40 py-8 transition hover:bg-white dark:bg-slate-800/60 dark:hover:bg-slate-800"
                >
                  Announcements
                </Link>
                <Link
                  href="#conf"
                  className="cursor-pointer bg-white/40 py-8 transition hover:bg-white dark:bg-slate-800/60 dark:hover:bg-slate-800"
                >
                  Launch Conf
                </Link>
                <Link
                  href="#community-partners"
                  className="cursor-pointer bg-white/40 py-8 transition hover:bg-white dark:bg-slate-800/60 dark:hover:bg-slate-800"
                >
                  Community Partners
                </Link>
                <Link
                  href="#code-of-conduct"
                  className="cursor-pointer bg-white/40 py-8 transition hover:bg-white dark:bg-slate-800/60 dark:hover:bg-slate-800"
                >
                  Code of Conduct
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full overflow-hidden">
          {/* Announcements */}
          <div className="mx-auto max-w-screen-lg px-5 py-5 xl:max-w-screen-xl">
            <div className="mt-24">
              <h2 id="announcements" className="font-input-mono my-10 text-3xl">
                Announcements
              </h2>
            </div>
          </div>

          <LaunchWeekAnnouncements />

          {/*Agenda*/}
          <div className="mx-auto max-w-screen-lg px-5 py-5 xl:max-w-screen-xl">
            <div className="mt-24">
              <h2 id="conf" className="font-input-mono my-10 text-3xl">
                Launch Conf
              </h2>
            </div>
          </div>
          <LaunchWeekAgenda />
          {/*SPEAKERS*/}
          <div className="mx-auto max-w-screen-lg px-5 py-5 xl:max-w-screen-xl">
            <div className="mt-24">
              <h2 id="speakers" className="font-input-mono my-20 text-3xl">
                Speakers
              </h2>
            </div>
          </div>
          <LaunchWeekSpeakers />

          {/*COMMUNITY PARTNERS*/}
          <div className="mx-auto max-w-screen-lg px-5 py-5 xl:max-w-screen-xl">
            <div className="mt-24">
              <h2
                id="community-partners"
                className="font-input-mono my-20 text-3xl"
              >
                Community Partners
              </h2>
            </div>
          </div>
          <LaunchNxCommunityPartners />

          {/*CODE OF CONDUCT*/}
          <div className="mx-auto max-w-screen-lg px-5 py-5 xl:max-w-screen-xl">
            <div className="mt-24">
              <h2
                id="code-of-conduct"
                className="font-input-mono my-20 text-3xl"
              >
                Code of Conduct (CoC)
              </h2>
            </div>
          </div>
          <CodeOfConduct />
        </div>
      </main>
      <Footer />;
    </>
  );
}

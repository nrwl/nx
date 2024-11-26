import { Footer, Header } from '@nx/nx-dev/ui-common';
import {
  LaunchWeekAgenda,
  LaunchWeekAnnouncements,
  LaunchWeekSpeakers,
  LaunchNxCommunityPartners,
  CodeOfConduct,
  LaunchNxIntro,
} from '@nx/nx-dev/ui-conference';
import { NextSeo } from 'next-seo';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function ConfPage(): JSX.Element {
  const router = useRouter();

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
        <Header />
        <LaunchNxIntro />
        {/*NAVIGATION*/}
        <div className="hidden border-b border-t border-slate-200 md:block dark:border-slate-700">
          <div className="mx-auto max-w-screen-lg xl:max-w-screen-xl">
            <div className="font-input-mono grid-cols-5 items-center divide-x divide-slate-200 text-center md:grid dark:divide-slate-700">
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

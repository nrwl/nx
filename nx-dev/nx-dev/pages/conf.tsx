import {
  ConfSchedule,
  ConfSpeakers,
  ConfSponsors,
  ConfWorkshop,
} from '@nrwl/nx-dev/feature-conf';
import { Footer, Header } from '@nrwl/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactComponentElement } from 'react';

export function ConfPage(): ReactComponentElement<any> {
  const router = useRouter();
  return (
    <>
      <NextSeo
        title="The first ever Nx Conf - September 16th-17th, 2021"
        description="Nx Conf is a new, free-to-attend, 2-day conference featuring members of the Nx team and community. Watch us as we share our ideas and expertise about making development faster, more scalable, and more collaborative."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'The first ever Nx Conf - September 16th-17th, 2021',
          description:
            'Nx Conf is a new, free-to-attend, 2-day conference featuring members of the Nx team and community. Watch us as we share our ideas and expertise about making development faster, more scalable, and more collaborative.',
          images: [
            {
              url: 'https://nx.dev/images/nx-conf-media.jpg',
              width: 1000,
              height: 500,
              alt: 'Nx: Smart, Fast and Extensible Build System',
              type: 'image/jpeg',
            },
          ],
          site_name: 'NxDev',
          type: 'website',
        }}
      />
      <Header useDarkBackground={true} />
      <main
        style={{
          background: 'linear-gradient(180deg, #143055 0%, #0b1a2d 100%)',
        }}
      >
        <div
          className="bg-blue-nx-base w-full overflow-hidden"
          style={{
            background:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'%3E%3Crect width='2' height='2' fill='white' fill-opacity='0.15'/%3E%3C/svg%3E\")",
          }}
        >
          {/*INTRO*/}
          <div className="mx-auto max-w-screen-lg px-5 py-5 text-white xl:max-w-screen-xl">
            <div className="mt-24 flex flex-col items-start py-48 lg:flex-row">
              <div className="relative mt-8 flex w-full flex-col pb-10 lg:mt-0 lg:w-2/5 lg:pb-0">
                <svg
                  id="nx-conf-glow"
                  className="absolute z-0 w-full"
                  style={{
                    transform: 'scale(1.5, 1.5) translate3d(-12%, -25%, 0)',
                  }}
                  width="700"
                  height="700"
                  viewBox="0 0 872 812"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g filter="url(#blur-100)">
                    <circle
                      cx="393.739"
                      cy="460.779"
                      r="196.739"
                      fill="url(#blob1)"
                    />
                    <circle
                      cx="511.696"
                      cy="267.957"
                      r="117.957"
                      fill="url(#blob2)"
                    />
                    <ellipse
                      cx="393.739"
                      cy="307.13"
                      rx="78.3475"
                      ry="78.7828"
                      fill="url(#blob3)"
                    />
                    <circle
                      cx="571.327"
                      cy="400.712"
                      r="136.673"
                      fill="url(#blob4)"
                    />
                  </g>
                  <defs>
                    <filter id="blur-100" filterUnits="userSpaceOnUse">
                      <feGaussianBlur stdDeviation="100" />
                    </filter>
                    <linearGradient
                      id="blob1"
                      x1="237.672"
                      y1="291.154"
                      x2="512.287"
                      y2="657.518"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="#70C6A6" />
                      <stop offset="1" stopColor="#45BC98" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient
                      id="blob2"
                      x1="511.713"
                      y1="150"
                      x2="511.713"
                      y2="456.644"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="#70C6A6" />
                      <stop offset="1" stopColor="#45BC98" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient
                      id="blob3"
                      x1="393.75"
                      y1="228.348"
                      x2="393.75"
                      y2="433.154"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="#70C6A6" />
                      <stop offset="1" stopColor="#45BC98" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient
                      id="blob4"
                      x1="571.346"
                      y1="264.039"
                      x2="571.346"
                      y2="619.339"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="#70C6A6" />
                      <stop offset="1" stopColor="#45BC98" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
                <svg
                  id="nx-conf-logo"
                  className="-left-60 -top-60 z-10 w-full"
                  role="img"
                  width="446"
                  height="86"
                  viewBox="0 0 446 86"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M407.071 31.4634V84.9512H417.42V31.4634H443.292V22.0244H417.42V17.7244C417.42 14.7878 418.558 12.6902 420.835 11.4317C423.112 10.1033 426.147 9.43902 429.942 9.43902C432.909 9.43902 435.461 9.68374 437.6 10.1732C439.808 10.5927 441.67 11.0472 443.188 11.5366L445.258 2.72683C443.257 2.02764 440.981 1.39837 438.428 0.839023C435.944 0.279675 433.116 0 429.942 0C423.457 0 418.006 1.57317 413.591 4.71951C409.244 7.79593 407.071 12.1659 407.071 17.8293V22.0244H389.478V31.4634H407.071Z"
                    fill="white"
                  />
                  <path
                    d="M180.934 80.0219C185.556 84.0073 192.386 86 201.424 86C209.427 86 215.567 84.3569 219.845 81.0707C224.122 77.7845 226.503 72.9252 226.986 66.4927L216.844 65.8634C216.637 69.4293 215.257 72.1211 212.704 73.939C210.152 75.687 206.392 76.561 201.424 76.561C195.698 76.561 191.42 75.3724 188.592 72.9951C185.832 70.6179 184.452 67.0171 184.452 62.1927V45.2024C184.452 40.1683 185.832 36.4626 188.592 34.0854C191.351 31.6382 195.56 30.4146 201.217 30.4146C206.254 30.4146 210.048 31.4634 212.601 33.561C215.154 35.6585 216.568 38.8748 216.844 43.2098L226.986 42.5805C226.503 35.5187 224.088 30.1699 219.741 26.5341C215.464 22.8285 209.324 20.9756 201.321 20.9756C192.352 20.9756 185.556 23.0382 180.934 27.1634C176.38 31.2187 174.104 37.2317 174.104 45.2024V62.1927C174.104 70.0236 176.38 75.9667 180.934 80.0219Z"
                    fill="white"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M253.208 79.9171C257.693 83.9724 264.109 86 272.457 86C280.805 86 287.187 83.9724 291.602 79.9171C296.086 75.7919 298.329 69.8837 298.329 62.1927V45.2024C298.329 37.4415 296.086 31.4634 291.602 27.2683C287.187 23.0732 280.839 20.9756 272.56 20.9756C264.212 20.9756 257.796 23.0732 253.312 27.2683C248.827 31.4634 246.585 37.4415 246.585 45.2024V62.1927C246.585 69.8837 248.793 75.7919 253.208 79.9171ZM284.151 72.9951C281.598 75.3724 277.7 76.561 272.457 76.561C267.214 76.561 263.316 75.3724 260.763 72.9951C258.21 70.6179 256.934 67.0171 256.934 62.1927V45.2024C256.934 40.1683 258.21 36.4626 260.763 34.0854C263.316 31.6382 267.214 30.4146 272.457 30.4146C277.7 30.4146 281.598 31.6382 284.151 34.0854C286.704 36.4626 287.98 40.1683 287.98 45.2024V62.1927C287.98 67.0171 286.704 70.6179 284.151 72.9951Z"
                    fill="white"
                  />
                  <path
                    d="M319.067 84.9512V22.0244H329.415V32.5122H332.52C334.038 28.9463 336.418 26.1496 339.661 24.122C342.903 22.0244 346.594 20.9756 350.734 20.9756C356.943 20.9756 361.841 22.8984 365.429 26.7439C369.017 30.5894 370.81 35.8333 370.81 42.4756V84.9512H360.462V44.5732C360.462 40.1683 359.392 36.8122 357.253 34.5049C355.184 32.1276 352.183 30.939 348.25 30.939C345.145 30.939 341.972 31.8829 338.729 33.7707C335.556 35.6585 332.451 38.3854 329.415 41.9512V84.9512H319.067Z"
                    fill="white"
                  />
                  <path
                    d="M0 21.9504V84.8056H10.3081V41.8545C13.3318 38.2927 16.4243 35.569 19.5854 33.6833C22.8153 31.7977 25.9765 30.8549 29.0689 30.8549C32.986 30.8549 35.9753 32.0421 38.037 34.4166C40.1673 36.7213 41.2325 40.0736 41.2325 44.4735V84.8056H51.5406V42.3783C51.5406 35.7436 49.7539 30.5056 46.1804 26.6645C42.6069 22.8234 37.7277 20.9028 31.5429 20.9028C27.4196 20.9028 23.743 21.9504 20.5132 24.0455C17.2833 26.0709 14.9124 28.8644 13.4006 32.4262H10.3081V21.9504H0Z"
                    fill="white"
                  />
                  <path
                    d="M97.3489 60.8158L113.327 84.8056H124.872L103.431 52.7494L125.284 21.9504H113.842L98.2767 44.9973L82.9176 21.9504H71.3725L92.298 53.2732L70.6509 84.8056H82.0929L97.3489 60.8158Z"
                    fill="white"
                  />
                </svg>
              </div>
              <div className="z-50 mt-8 flex w-full flex-col pb-10 lg:mt-0 lg:w-3/5 lg:pl-16 lg:pb-0">
                <h2 className="my-6">
                  <div className="font-input-mono bg-blue-nx-dark mb-4 inline-block rounded-md py-4 px-6 text-xl font-extrabold leading-none tracking-tight sm:text-2xl lg:text-2xl">
                    <span className="hidden">
                      Announcing the first ever Nx Conf on{' '}
                    </span>{' '}
                    September 16 & 17, 2021
                  </div>
                </h2>
                <p className="mb-6 sm:text-lg">
                  Nx Conf is a new, online & free-to-attend, 2-day conference
                  featuring members of the Nx team and community. Watch us as we
                  share our ideas and expertise about making development faster,
                  more scalable, and more collaborative.
                </p>
                {/* <ul className="sm:text-lg list-disc list-inside mb-6">
                  Here are just a few of our confirmed speakers…
                  <li className="mt-4">
                    <a
                      href="https://twitter.com/jeffbcross"
                      target="_blank"
                      rel="nofollow"
                      className="underline pointer"
                    >
                      Jeff Cross
                    </a>{' '}
                    and{' '}
                    <a
                      href="https://twitter.com/victorsavkin"
                      target="_blank"
                      rel="nofollow"
                      className="underline pointer"
                    >
                      Victor Savkin
                    </a>
                    , co-founders of Nrwl and creators of Nx
                  </li>
                  <li className="mt-4">The Nx Core Team at Nrwl</li>
                  <li className="mt-4">
                    <a
                      href="https://twitter.com/ManfredSteyer"
                      target="_blank"
                      rel="nofollow"
                      className="underline pointer"
                    >
                      Manfred Steyer
                    </a>
                    , speaker, trainer, consultant, and director of
                    ANGULARarchitects
                  </li>
                  <li className="mt-4">
                    <a
                      href="https://twitter.com/wwwalkerrun"
                      target="_blank"
                      rel="nofollow"
                      className="underline pointer"
                    >
                      Nathan Walker
                    </a>
                    , Angular advocate and expert
                  </li>
                  <li className="mt-4">
                    <a
                      href="https://twitter.com/yallen011"
                      target="_blank"
                      rel="nofollow"
                      className="underline pointer"
                    >
                      Yvonne Allen
                    </a>
                    , Angular GDE
                  </li>
                  <li className="mt-4">
                    <a
                      href="https://twitter.com/MrJamesHenry"
                      target="_blank"
                      rel="nofollow"
                      className="underline pointer"
                    >
                      James Henry
                    </a>
                    , 4x MVP @Microsoft, ESLint Team Alum, creator of @TSESLint
                    , Babel + Prettier Teams
                  </li>
                  <li className="mt-4">Lightning talks from the community</li>
                </ul>
                <p className="sm:text-lg mb-6">
                  In addition to the conference there will be a{' '}
                  <b>2-day workshop on September 14th and 15th</b> on{' '}
                  <b>How to Develop at Scale with Nx Monorepos</b>, presented by
                  members of the Nx Core Team. Workshop registration is $800 per
                  attendee.
                </p>
                <p className="sm:text-lg mb-6">
                  Grab your FREE Nx Conf ticket and save your workshop seat
                  today!
                </p> */}
                <div className="mt-16 flex">
                  <a
                    className="font-input-mono group flex w-full items-center justify-end sm:text-2xl"
                    href="https://www.youtube.com/watch?v=oG2QbFquraA"
                  >
                    <span className="group-hover:underline">Watch Day 1</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="ml-1 h-8 w-8 transform-gpu transition duration-200 ease-out group-hover:translate-x-2 "
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </a>
                  <a
                    className="font-input-mono group flex w-full items-center justify-end sm:text-2xl"
                    href="https://www.youtube.com/watch?v=hlGOaGDsWKg"
                  >
                    <span className="group-hover:underline">Watch Day 2</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="ml-1 h-8 w-8 transform-gpu transition duration-200 ease-out group-hover:translate-x-2 "
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="w-full overflow-hidden">
          {/*NAVIGATION*/}
          <div className="hidden border-t border-b border-gray-600 md:block">
            <div className="mx-auto max-w-screen-lg text-white xl:max-w-screen-xl">
              <div className="font-input-mono grid-cols-7 items-center divide-x divide-gray-600 text-center md:grid">
                <div className="p-8">
                  <svg
                    id="nx-conf-logo"
                    className="w-22 inline-block"
                    role="img"
                    viewBox="0 0 446 86"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M407.071 31.4634V84.9512H417.42V31.4634H443.292V22.0244H417.42V17.7244C417.42 14.7878 418.558 12.6902 420.835 11.4317C423.112 10.1033 426.147 9.43902 429.942 9.43902C432.909 9.43902 435.461 9.68374 437.6 10.1732C439.808 10.5927 441.67 11.0472 443.188 11.5366L445.258 2.72683C443.257 2.02764 440.981 1.39837 438.428 0.839023C435.944 0.279675 433.116 0 429.942 0C423.457 0 418.006 1.57317 413.591 4.71951C409.244 7.79593 407.071 12.1659 407.071 17.8293V22.0244H389.478V31.4634H407.071Z"
                      fill="white"
                    />
                    <path
                      d="M180.934 80.0219C185.556 84.0073 192.386 86 201.424 86C209.427 86 215.567 84.3569 219.845 81.0707C224.122 77.7845 226.503 72.9252 226.986 66.4927L216.844 65.8634C216.637 69.4293 215.257 72.1211 212.704 73.939C210.152 75.687 206.392 76.561 201.424 76.561C195.698 76.561 191.42 75.3724 188.592 72.9951C185.832 70.6179 184.452 67.0171 184.452 62.1927V45.2024C184.452 40.1683 185.832 36.4626 188.592 34.0854C191.351 31.6382 195.56 30.4146 201.217 30.4146C206.254 30.4146 210.048 31.4634 212.601 33.561C215.154 35.6585 216.568 38.8748 216.844 43.2098L226.986 42.5805C226.503 35.5187 224.088 30.1699 219.741 26.5341C215.464 22.8285 209.324 20.9756 201.321 20.9756C192.352 20.9756 185.556 23.0382 180.934 27.1634C176.38 31.2187 174.104 37.2317 174.104 45.2024V62.1927C174.104 70.0236 176.38 75.9667 180.934 80.0219Z"
                      fill="white"
                    />
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M253.208 79.9171C257.693 83.9724 264.109 86 272.457 86C280.805 86 287.187 83.9724 291.602 79.9171C296.086 75.7919 298.329 69.8837 298.329 62.1927V45.2024C298.329 37.4415 296.086 31.4634 291.602 27.2683C287.187 23.0732 280.839 20.9756 272.56 20.9756C264.212 20.9756 257.796 23.0732 253.312 27.2683C248.827 31.4634 246.585 37.4415 246.585 45.2024V62.1927C246.585 69.8837 248.793 75.7919 253.208 79.9171ZM284.151 72.9951C281.598 75.3724 277.7 76.561 272.457 76.561C267.214 76.561 263.316 75.3724 260.763 72.9951C258.21 70.6179 256.934 67.0171 256.934 62.1927V45.2024C256.934 40.1683 258.21 36.4626 260.763 34.0854C263.316 31.6382 267.214 30.4146 272.457 30.4146C277.7 30.4146 281.598 31.6382 284.151 34.0854C286.704 36.4626 287.98 40.1683 287.98 45.2024V62.1927C287.98 67.0171 286.704 70.6179 284.151 72.9951Z"
                      fill="white"
                    />
                    <path
                      d="M319.067 84.9512V22.0244H329.415V32.5122H332.52C334.038 28.9463 336.418 26.1496 339.661 24.122C342.903 22.0244 346.594 20.9756 350.734 20.9756C356.943 20.9756 361.841 22.8984 365.429 26.7439C369.017 30.5894 370.81 35.8333 370.81 42.4756V84.9512H360.462V44.5732C360.462 40.1683 359.392 36.8122 357.253 34.5049C355.184 32.1276 352.183 30.939 348.25 30.939C345.145 30.939 341.972 31.8829 338.729 33.7707C335.556 35.6585 332.451 38.3854 329.415 41.9512V84.9512H319.067Z"
                      fill="white"
                    />
                    <path
                      d="M0 21.9504V84.8056H10.3081V41.8545C13.3318 38.2927 16.4243 35.569 19.5854 33.6833C22.8153 31.7977 25.9765 30.8549 29.0689 30.8549C32.986 30.8549 35.9753 32.0421 38.037 34.4166C40.1673 36.7213 41.2325 40.0736 41.2325 44.4735V84.8056H51.5406V42.3783C51.5406 35.7436 49.7539 30.5056 46.1804 26.6645C42.6069 22.8234 37.7277 20.9028 31.5429 20.9028C27.4196 20.9028 23.743 21.9504 20.5132 24.0455C17.2833 26.0709 14.9124 28.8644 13.4006 32.4262H10.3081V21.9504H0Z"
                      fill="white"
                    />
                    <path
                      d="M97.3489 60.8158L113.327 84.8056H124.872L103.431 52.7494L125.284 21.9504H113.842L98.2767 44.9973L82.9176 21.9504H71.3725L92.298 53.2732L70.6509 84.8056H82.0929L97.3489 60.8158Z"
                      fill="white"
                    />
                  </svg>
                </div>
                <Link href="#agenda">
                  <a className="hover:bg-blue-nx-dark cursor-pointer p-8 transition">
                    Agenda
                  </a>
                </Link>
                <Link href="#speakers">
                  <a className="hover:bg-blue-nx-dark cursor-pointer p-8 transition">
                    Speakers
                  </a>
                </Link>
                <Link href="#workshop">
                  <a className="hover:bg-blue-nx-dark cursor-pointer p-8 transition">
                    Workshop
                  </a>
                </Link>
                <Link href="#sponsors">
                  <a className="hover:bg-blue-nx-dark cursor-pointer p-8 transition">
                    Sponsors
                  </a>
                </Link>
              </div>
            </div>
          </div>

          {/*AGENDA*/}
          <div className="mx-auto max-w-screen-lg px-5 py-5 text-white xl:max-w-screen-xl">
            <div className="mt-24">
              <h2 id="agenda" className="font-input-mono my-20 text-3xl">
                Agenda (EST)
              </h2>
            </div>
          </div>
          <ConfSchedule />

          {/*SPEAKERS*/}
          <div className="mx-auto max-w-screen-lg px-5 py-5 text-white xl:max-w-screen-xl">
            <div className="mt-24">
              <h2 id="speakers" className="font-input-mono my-20 text-3xl">
                Speakers
              </h2>
            </div>
          </div>
          <ConfSpeakers />

          <div className="mx-auto max-w-screen-lg px-5 py-5 text-white xl:max-w-screen-xl">
            {/*WORKSHOP*/}
            <div className="mt-24">
              <h2 id="workshop" className="font-input-mono my-20 text-3xl">
                Workshop
              </h2>
            </div>
          </div>
          <ConfWorkshop />

          {/*SPONSORS*/}
          <div className="mx-auto max-w-screen-lg px-5 py-5 text-white xl:max-w-screen-xl">
            <div className="mt-24">
              <h2 id="sponsors" className="font-input-mono my-20 text-3xl">
                Sponsors
              </h2>
            </div>
          </div>
          <ConfSponsors />

          <div className="mx-auto max-w-screen-lg px-5 py-5 text-white xl:max-w-screen-xl">
            {/*SPONSORS*/}
            {/*<div className="my-24">*/}
            {/*  <h2 id="sponsors" className="my-20 text-3xl font-input-mono">*/}
            {/*    Sponsors*/}
            {/*  </h2>*/}
            {/*  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-8">*/}
            {/*    <div>*/}
            {/*      <svg viewBox="0 0 262 163" className="w-16">*/}
            {/*        <polygon*/}
            {/*          id="Path"*/}
            {/*          fill="#ffffff"*/}
            {/*          points="130.68 104.59 97.49 52.71 97.44 96.3 40.24 0 0 0 0 162.57 39.79 162.57 39.92 66.39 96.53 158.26"*/}
            {/*        />*/}
            {/*        <polygon*/}
            {/*          id="Path"*/}
            {/*          fill="#ffffff"*/}
            {/*          points="97.5 41.79 137.24 41.79 137.33 41.33 137.33 0 97.54 0 97.49 41.33"*/}
            {/*        />*/}
            {/*        <path*/}
            {/*          d="M198.66,86.86 C189.139872,86.6795216 180.538723,92.516445 177.19,101.43 C182.764789,93.0931021 193.379673,89.7432211 202.73,93.37 C207.05,95.13 212.73,97.97 217.23,96.45 C212.950306,90.4438814 206.034895,86.8725952 198.66,86.86 L198.66,86.86 Z"*/}
            {/*          id="Path"*/}
            {/*          fill="#96D8E9"*/}
            {/*        />*/}
            {/*        <path*/}
            {/*          d="M243.75,106.42 C243.75,101.55 241.1,100.42 235.6,98.42 C231.52,97 226.89,95.4 223.52,91 C222.86,90.13 222.25,89.15 221.6,88.11 C220.14382,85.4164099 218.169266,83.037429 215.79,81.11 C212.58,78.75 208.37,77.6 202.91,77.6 C191.954261,77.6076705 182.084192,84.2206169 177.91,94.35 C183.186964,87.0278244 191.956716,83.0605026 200.940147,83.9314609 C209.923578,84.8024193 217.767888,90.3805017 221.54,98.58 C223.424615,101.689762 227.141337,103.174819 230.65,102.22 C236.02,101.07 235.65,106.15 243.76,107.87 L243.75,106.42 Z"*/}
            {/*          id="Path"*/}
            {/*          fill="#48C4E5"*/}
            {/*        />*/}
            {/*        <path*/}
            {/*          d="M261.46,105.38 L261.46,105.27 C261.34,73.03 235.17,45.45 202.91,45.45 C183.207085,45.4363165 164.821777,55.3450614 154,71.81 L153.79,71.45 L137.23,45.45 L97.5,45.4499858 L135.25,104.57 L98.41,162.57 L137,162.57 L153.79,136.78 L170.88,162.57 L209.48,162.57 L174.48,107.49 C173.899005,106.416838 173.583536,105.220114 173.56,104 C173.557346,96.2203871 176.64661,88.7586448 182.147627,83.2576275 C187.648645,77.7566101 195.110387,74.6673462 202.89,74.67 C219.11,74.67 221.82,84.37 225.32,88.93 C232.23,97.93 246.03,93.99 246.03,105.73 L246.03,105.73 C246.071086,108.480945 247.576662,111.001004 249.979593,112.340896 C252.382524,113.680787 255.317747,113.636949 257.679593,112.225896 C260.041438,110.814842 261.471086,108.250945 261.43,105.5 L261.43,105.5 L261.43,105.38 L261.46,105.38 Z"*/}
            {/*          id="Path"*/}
            {/*          fill="#ffffff"*/}
            {/*        />*/}
            {/*        <path*/}
            {/*          d="M261.5,113.68 C261.892278,116.421801 261.504116,119.218653 260.38,121.75 C258.18,126.84 254.51,125.14 254.51,125.14 C254.51,125.14 251.35,123.6 253.27,120.65 C255.4,117.36 259.61,117.74 261.5,113.68 Z"*/}
            {/*          id="Path"*/}
            {/*          fill="#022f56"*/}
            {/*        />*/}
            {/*      </svg>*/}
            {/*    </div>*/}
            {/*    <div>*/}
            {/*      <svg*/}
            {/*        xmlns="http://www.w3.org/2000/svg"*/}
            {/*        viewBox="0 0 402.35 125.53"*/}
            {/*      >*/}
            {/*        <g id="Layer_2" data-name="Layer 2">*/}
            {/*          <g id="Layer_1-2" data-name="Layer 1">*/}
            {/*            <g*/}
            {/*              id="Color_on_white_horizontal"*/}
            {/*              data-name="Color on white horizontal"*/}
            {/*            >*/}
            {/*              <g id="LOGO">*/}
            {/*                <polygon*/}
            {/*                  points="123.6 110.85 123.6 125.53 146.69 125.53 146.69 113.02 123.6 110.85"*/}
            {/*                  fill="#fff"*/}
            {/*                />*/}
            {/*                <g id="whale">*/}
            {/*                  <g id="bdy">*/}
            {/*                    <path*/}
            {/*                      id="tusk"*/}
            {/*                      d="M91.09,105.22a3,3,0,0,1,3-3h.27a1.86,1.86,0,0,1,.63.12L165.45,115l-71.81-6.75h0A3,3,0,0,1,91.09,105.22Z"*/}
            {/*                      fill="#48c4e5"*/}
            {/*                    />*/}
            {/*                    <path*/}
            {/*                      d="M124,50.79h-.19C119,50,114.3,46.49,112.7,42h0a57.4,57.4,0,1,0-72.37,70.24A74.28,74.28,0,0,0,90.41,109c3.78-1.79,4.45-4.63,4.45-6.48s-1.64-3.07-2.24-3.89a2.25,2.25,0,0,1-.54-1.18h0a27.51,27.51,0,0,0-27.44-25.6H62.87a23.35,23.35,0,0,1-16.68-39.7,30.15,30.15,0,0,1,22-9.42A30.57,30.57,0,0,1,97.76,45.39a15.33,15.33,0,0,1-9.11,5.36A15.15,15.15,0,0,0,76.31,63.29c5.88,0,9.79,8,20.71,8a9.9,9.9,0,0,0,9.18-6.16,9.93,9.93,0,0,0,9.19,6.16,19.63,19.63,0,0,0,8.56-1.9Zm-64.79,48c.35-1.46,1.52-.84,3.06-.46s2.86.36,2.51,1.81a2.87,2.87,0,0,1-5.57-1.35Z"*/}
            {/*                      fill="#48c4e5"*/}
            {/*                    />*/}
            {/*                    <g id="right_fin" data-name="right fin">*/}
            {/*                      <path*/}
            {/*                        d="M52.51,69.4A9.4,9.4,0,0,1,60.85,62h0A8.43,8.43,0,0,0,64,68.72,8.45,8.45,0,0,1,67,72v3H52.51Z"*/}
            {/*                        fill="#48c4e5"*/}
            {/*                      />*/}
            {/*                    </g>*/}
            {/*                  </g>*/}
            {/*                  <g id="highlights">*/}
            {/*                    <path*/}
            {/*                      d="M12.9,93.81A57.61,57.61,0,0,1,43.37,1.7C24.74,7,3.9,24,3.9,53.7c0,37.66,31.34,45,45.91,51.72,8.85,4.11,12,7.56,13.19,9.64H60.84a73.74,73.74,0,0,1-20.51-2.88c-6.84-2.07-14.65-6.64-20.1-10.93.77.11-3.85-2.6-8.39-8.82"*/}
            {/*                      fill="#96d8e9"*/}
            {/*                    />*/}
            {/*                    <ellipse*/}
            {/*                      cx="24.58"*/}
            {/*                      cy="61.18"*/}
            {/*                      rx="1.95"*/}
            {/*                      ry="2.79"*/}
            {/*                      transform="translate(-13.17 7.12) rotate(-13.04)"*/}
            {/*                      fill="#96d8e9"*/}
            {/*                    />*/}
            {/*                    <ellipse*/}
            {/*                      cx="32.38"*/}
            {/*                      cy="72.47"*/}
            {/*                      rx="2.56"*/}
            {/*                      ry="3.66"*/}
            {/*                      transform="translate(-38.68 37.09) rotate(-39.46)"*/}
            {/*                      fill="#96d8e9"*/}
            {/*                    />*/}
            {/*                    <ellipse*/}
            {/*                      cx="31.51"*/}
            {/*                      cy="47.37"*/}
            {/*                      rx="2.79"*/}
            {/*                      ry="1.95"*/}
            {/*                      transform="translate(-17.99 75.41) rotate(-85.89)"*/}
            {/*                      fill="#96d8e9"*/}
            {/*                    />*/}
            {/*                    <ellipse*/}
            {/*                      cx="24.79"*/}
            {/*                      cy="51"*/}
            {/*                      rx="0.98"*/}
            {/*                      ry="1.4"*/}
            {/*                      transform="translate(-2.13 1.09) rotate(-2.42)"*/}
            {/*                      fill="#96d8e9"*/}
            {/*                    />*/}
            {/*                    <path*/}
            {/*                      id="left_fin"*/}
            {/*                      data-name="left fin"*/}
            {/*                      d="M38.21,105.63a28.73,28.73,0,0,1-15,7.18q-1.22.18-2.46.27A28.61,28.61,0,0,1,16,113h0a35,35,0,0,0-5.7-.1,33.41,33.41,0,0,0-9.48,2h0A11.66,11.66,0,0,1,11,99a11.45,11.45,0,0,1,6.55,1.5h0A11.92,11.92,0,0,0,24,102.06a11.51,11.51,0,0,0,5.8-2s1.34-1.17,4.5.87C38.92,103.91,38.21,105.63,38.21,105.63Z"*/}
            {/*                      fill="#96d8e9"*/}
            {/*                    />*/}
            {/*                  </g>*/}
            {/*                </g>*/}
            {/*                <polygon*/}
            {/*                  points="179.78 43.53 179.78 87.23 143 43.53 123.6 43.53 123.6 103.07 146.69 108.53 146.69 81.84 183.47 125.53 202.87 125.53 202.87 43.53 179.78 43.53"*/}
            {/*                  fill="#fff"*/}
            {/*                />*/}
            {/*                <path*/}
            {/*                  d="M244.5,63.16A34.49,34.49,0,0,1,257.18,61V81a49.24,49.24,0,0,0-5.15-.3q-7.26,0-11.37,3.86t-4.08,11.84v29.16H214V62h21.54v7.62A21,21,0,0,1,244.5,63.16Z"*/}
            {/*                  fill="#fff"*/}
            {/*                />*/}
            {/*                <path*/}
            {/*                  d="M362.19,62l-18.35,63.49h-21.9l-7.53-29.1-8,29.1h-21.9L266.16,62h21.43l8.59,32.06L305.25,62h19.28l8.71,32.41L342.31,62Z"*/}
            {/*                  fill="#fff"*/}
            {/*                />*/}
            {/*                <path*/}
            {/*                  d="M393.31,28.61H370.64v74c0,19.88,12.84,22.41,24.89,22.41,3.67,0,6.82-.35,6.82-.35V107.41s-1.31.12-2.75.12c-5.11,0-6.29-2-6.29-7.59Z"*/}
            {/*                  fill="#fff"*/}
            {/*                />*/}
            {/*              </g>*/}
            {/*            </g>*/}
            {/*          </g>*/}
            {/*        </g>*/}
            {/*      </svg>*/}
            {/*    </div>*/}
            {/*  </div>*/}
            {/*</div>*/}
          </div>
        </div>
      </main>
      <Footer useDarkBackground={true} />
    </>
  );
}

export default ConfPage;

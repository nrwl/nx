import React from 'react';
import Head from 'next/head';
import { Footer, Header } from '@nrwl/nx-dev/ui/common';
import { useStorage } from '../lib/use-storage';

export function ConfPage() {
  const { value: storedFlavor } = useStorage('flavor');
  const { value: storedVersion } = useStorage('version');
  return (
    <>
      <Head>
        <title>Announcing the first ever Nx Conf - September 16th-17th</title>
        <meta
          name="description"
          content="Nx Conf is a new, free-to-attend, 2-day conference featuring members of the Nx team and community. Join us as we share our ideas and expertise about making development faster, more scalable, and more collaborative."
        />
        <meta
          name="twitter:title"
          content="Announcing the first ever Nx Conf - September 16th-17th"
        />
        <meta
          name="twitter:description"
          content="Nx Conf is a new, free-to-attend, 2-day conference featuring members of the Nx team and community. Join us as we share our ideas and expertise about making development faster, more scalable, and more collaborative."
        />
        <meta
          name="twitter:image"
          content="https://nx.dev/images/nx-conf-media.jpg"
        />
        <meta
          name="twitter:image:alt"
          content="Nx Conf - Nx: Smart, Extensible Build Framework"
        />
        <meta property="og:url" content="https://nx.dev/conf" />
        <meta
          property="og:description"
          content="Nx Conf is a new, free-to-attend, 2-day conference featuring members of the Nx team and community. Join us as we share our ideas and expertise about making development faster, more scalable, and more collaborative."
        />
        <meta
          property="og:title"
          content="Announcing the first ever Nx Conf - September 16th-17th"
        />
        <meta
          property="og:image"
          content="https://nx.dev/images/nx-conf-media.jpg"
        />
        <meta property="og:image:width" content="1000" />
        <meta property="og:image:height" content="500" />
      </Head>
      <Header
        useDarkBackground={true}
        showSearch={false}
        flavor={{
          name: storedFlavor || 'react',
          value: storedFlavor || 'react',
        }}
        version={{
          name: storedVersion || 'Latest',
          value: storedVersion || 'latest',
        }}
      />
      <main>
        <div
          className="w-full overflow-hidden bg-blue-nx-base"
          style={{
            background:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'%3E%3Crect width='2' height='2' fill='white' fill-opacity='0.15'/%3E%3C/svg%3E\"), linear-gradient(180deg, #143055 0%, #0b1a2d 100%)",
          }}
        >
          {/*Nx conf*/}
          <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto px-5 py-5 text-white">
            <div className="mt-24 py-48 flex lg:flex-row flex-col items-start">
              <div className="w-full lg:w-2/5 flex flex-col lg:pb-0 pb-10 mt-8 lg:mt-0 relative">
                <svg
                  id="nx-conf-glow"
                  className="z-0 absolute w-full"
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
                  className="z-10 -left-60 -top-60 w-full"
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
              <div className="w-full lg:w-3/5 flex flex-col lg:pl-16 lg:pb-0 pb-10 mt-8 lg:mt-0">
                <h2 className="my-6">
                  <div className="inline-block py-4 px-6 text-xl sm:text-2xl lg:text-2xl leading-none font-input-mono font-extrabold tracking-tight py-4 px-6 mb-4 bg-blue-nx-dark rounded-md">
                    <span className="hidden">
                      Announcing the first ever Nx Conf on{' '}
                    </span>{' '}
                    September 16 & 17
                  </div>
                </h2>
                <p className="sm:text-lg mb-6">
                  Nx Conf is a new, online & free-to-attend, 2-day conference
                  featuring members of the Nx team and community. Join us as we
                  share our ideas and expertise about making development faster,
                  more scalable, and more collaborative.
                </p>
                <ul className="sm:text-lg list-disc list-inside mb-6">
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
                  <li className="mt-4">
                    <a
                      href="https://twitter.com/cotufa82"
                      target="_blank"
                      rel="nofollow"
                      className="underline pointer"
                    >
                      Diana Rodriguez
                    </a>
                    , GDE, Microsoft MVP, Women Techmaker Ambassador and Auth0
                    Ambassador
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
                </p>
                <div className="flex mt-16">
                  <a
                    className="flex items-center justify-end font-input-mono group w-full sm:text-2xl"
                    href="https://ti.to/nrwl/nx-conf-2021?utm_source=nxdev"
                  >
                    <span className="group-hover:underline">Register now</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="ml-1 h-8 w-8 transform-gpu transition ease-out duration-200 group-hover:translate-x-2 "
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
      </main>
      <Footer useDarkBackground={true} />
    </>
  );
}

export default ConfPage;

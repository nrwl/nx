import { Footer, Header } from '@nx/nx-dev/ui-common';
import {
  ConfHealthAndSafety,
  ConfLocation,
  ConfScheduleShort,
  ConfSpeakers,
} from '@nx/nx-dev/ui-conference';
import { NextSeo } from 'next-seo';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Script from 'next/script';

export default function ConfPage(): JSX.Element {
  const router = useRouter();
  return (
    <>
      <NextSeo
        title="Nx Conf 2023 - September 26th, 2023"
        description="Nx Conf is a conference featuring members of the Nx team and the community. Join us as we share our ideas and expertise about monorepos and making development faster, more scalable, and more collaborative."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx Conf 2023 - September 26th, 2023',
          description:
            'Nx Conf is a conference featuring members of the Nx team and the community. Join us as we share our ideas and expertise about monorepos and making development faster, more scalable, and more collaborative.',
          images: [
            {
              url: 'https://nx.dev/images/nx-conf-2023-media.jpg',
              width: 1000,
              height: 500,
              alt: 'Nx Conf 2023 - September 26th, 2023',
              type: 'image/jpeg',
            },
          ],
          siteName: 'NxDev',
          type: 'website',
        }}
      />
      <Header />
      <main id="main" role="main">
        <div
          className="w-full overflow-hidden bg-slate-50 dark:bg-slate-800/40"
          style={{
            background:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'%3E%3Crect width='2' height='2' fill='rgb(59,130,246)' fill-opacity='0.15'/%3E%3C/svg%3E\")",
          }}
        >
          {/*INTRO*/}
          <div className="mx-auto max-w-screen-lg px-5 py-5 xl:max-w-screen-xl">
            <div className="mt-24 flex flex-col items-start py-48 lg:flex-row">
              <div className="relative mt-8 flex w-full flex-col pb-10 lg:mt-0 lg:w-2/5 lg:pb-0">
                <svg
                  id="nx-conf-logo"
                  className="-left-60 -top-60 w-full dark:text-white"
                  width="290"
                  height="268"
                  viewBox="0 0 290 268"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M1.96704 1.10176V67.2075H11.3214V21.7047C14.7697 17.6649 18.2547 14.58 21.7763 12.4499C25.3714 10.3198 28.893 9.2548 32.3413 9.2548C36.8901 9.2548 40.3384 10.6136 42.6861 13.3313C45.1073 15.9755 46.3178 19.8684 46.3178 25.01V67.2075H55.6722V23.137C55.6722 16.0123 53.6913 10.3933 49.7294 6.28004C45.7676 2.09335 40.4117 0 33.6619 0C29.4066 0 25.5548 1.10176 22.1065 3.30529C18.7316 5.43536 16.2371 8.29994 14.623 11.899H11.3214V1.10176H1.96704Z" />
                  <path d="M105.239 40.8752L122.957 67.2073H133.742L110.961 33.6035L134.622 1.10156H123.837L106.119 26.7726L89.0611 1.10156H78.1659L100.506 34.1544L77.5056 67.2073H88.2907L105.239 40.8752Z" />
                  <path d="M249.602 179.311V122.02H230.673V113.206H249.602V108.578C249.602 102.849 251.877 98.4419 256.425 95.3569C260.974 92.272 266.55 90.7295 273.153 90.7295C276.601 90.7295 279.61 91.0601 282.177 91.7211C284.819 92.3087 287.166 92.9331 289.221 93.5941L287.02 101.968C285.479 101.453 283.535 100.976 281.187 100.535C278.913 100.021 276.088 99.764 272.713 99.764C268.531 99.764 265.193 100.425 262.698 101.747C260.204 102.996 258.957 105.126 258.957 108.137V113.206H286.91V122.02H258.957V179.311H249.602Z" />
                  <path d="M30.4704 180.413C21.0793 180.413 13.9627 178.32 9.1204 174.133C4.35149 169.946 1.96704 163.776 1.96704 155.623V137.555C1.96704 129.108 4.35149 122.754 9.1204 118.494C13.8893 114.234 20.9693 112.104 30.3604 112.104C38.5775 112.104 44.9605 113.977 49.5093 117.723C54.0581 121.395 56.5893 126.941 57.1029 134.359L47.8586 134.8C47.5651 130.173 45.951 126.721 43.0163 124.444C40.155 122.093 35.9363 120.918 30.3604 120.918C23.9774 120.918 19.2085 122.277 16.0537 124.994C12.8988 127.639 11.3214 131.715 11.3214 137.224V155.844C11.3214 161.132 12.8988 165.099 16.0537 167.743C19.2818 170.314 24.1241 171.599 30.5805 171.599C36.083 171.599 40.265 170.644 43.1263 168.734C46.0611 166.751 47.6385 163.813 47.8586 159.92L57.1029 160.361C56.5893 166.972 54.0214 171.966 49.3993 175.345C44.8505 178.724 38.5409 180.413 30.4704 180.413Z" />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M105.899 180.413C97.168 180.413 90.4915 178.283 85.8693 174.023C81.3205 169.689 79.0461 163.483 79.0461 155.403V137.555C79.0461 129.328 81.3572 123.048 85.9794 118.714C90.6016 114.307 97.278 112.104 106.009 112.104C114.666 112.104 121.269 114.307 125.818 118.714C130.44 123.048 132.751 129.291 132.751 137.444V155.293C132.751 163.446 130.44 169.689 125.818 174.023C121.269 178.283 114.63 180.413 105.899 180.413ZM105.899 171.599C111.842 171.599 116.244 170.277 119.105 167.633C121.966 164.988 123.397 160.985 123.397 155.623V137.334C123.397 131.825 121.966 127.712 119.105 124.994C116.244 122.277 111.842 120.918 105.899 120.918C99.9559 120.918 95.5539 122.277 92.6925 124.994C89.8312 127.712 88.4005 131.862 88.4005 137.444V155.734C88.4005 161.022 89.8312 164.988 92.6925 167.633C95.5539 170.277 99.9559 171.599 105.899 171.599Z"
                  />
                  <path d="M156.125 113.206V179.311H165.48V133.809C168.928 129.769 172.413 126.684 175.935 124.554C179.53 122.424 183.051 121.359 186.5 121.359C191.048 121.359 194.497 122.717 196.844 125.435C199.266 128.079 200.476 131.972 200.476 137.114V179.311H209.831V135.241C209.831 128.116 207.85 122.497 203.888 118.384C199.926 114.197 194.57 112.104 187.82 112.104C183.565 112.104 179.713 113.206 176.265 115.409C172.89 117.539 170.395 120.404 168.781 124.003H165.48V113.206H156.125Z" />
                  <path d="M18.0135 222.552L0.220703 268H4.26857L22.0614 222.552H18.0135Z" />
                  <path d="M45 266.481V263.144L57.4803 249.428C58.945 247.821 60.1512 246.425 61.0989 245.239C62.0466 244.04 62.7481 242.915 63.2035 241.865C63.6712 240.802 63.9051 239.69 63.9051 238.529C63.9051 237.194 63.5851 236.038 62.9451 235.062C62.3174 234.086 61.4558 233.332 60.3604 232.801C59.265 232.269 58.0342 232.004 56.668 232.004C55.2156 232.004 53.9479 232.307 52.8648 232.912C51.794 233.505 50.9632 234.339 50.3724 235.414C49.794 236.49 49.5047 237.75 49.5047 239.196H45.1477C45.1477 236.971 45.6585 235.019 46.68 233.338C47.7016 231.658 49.0924 230.348 50.8525 229.409C52.6248 228.47 54.6126 228 56.8157 228C59.0311 228 60.9943 228.47 62.7051 229.409C64.4159 230.348 65.7575 231.615 66.7298 233.209C67.7021 234.803 68.1883 236.576 68.1883 238.529C68.1883 239.925 67.936 241.29 67.4313 242.625C66.939 243.947 66.0775 245.424 64.8467 247.055C63.6282 248.674 61.9358 250.651 59.7696 252.987L51.2771 262.106V262.403H68.8529V266.481H45Z" />
                  <path d="M88.8103 267C86.0287 267 83.6594 266.24 81.7025 264.72C79.7455 263.188 78.2501 260.97 77.2162 258.066C76.1823 255.149 75.6654 251.627 75.6654 247.5C75.6654 243.397 76.1823 239.894 77.2162 236.99C78.2624 234.074 79.764 231.849 81.7209 230.317C83.6902 228.772 86.0533 228 88.8103 228C91.5673 228 93.9243 228.772 95.8813 230.317C97.8506 231.849 99.3522 234.074 100.386 236.99C101.432 239.894 101.955 243.397 101.955 247.5C101.955 251.627 101.438 255.149 100.404 258.066C99.3706 260.97 97.8752 263.188 95.9182 264.72C93.9612 266.24 91.592 267 88.8103 267ZM88.8103 262.922C91.5673 262.922 93.7089 261.587 95.2351 258.918C96.7613 256.249 97.5244 252.443 97.5244 247.5C97.5244 244.213 97.1736 241.414 96.4721 239.103C95.7828 236.792 94.7859 235.031 93.4812 233.82C92.1889 232.609 90.6319 232.004 88.8103 232.004C86.078 232.004 83.9425 233.357 82.404 236.063C80.8655 238.757 80.0963 242.569 80.0963 247.5C80.0963 250.787 80.4409 253.58 81.1301 255.878C81.8194 258.177 82.8102 259.925 84.1025 261.124C85.4072 262.323 86.9764 262.922 88.8103 262.922Z" />
                  <path d="M108.971 266.481V263.144L121.451 249.428C122.916 247.821 124.122 246.425 125.07 245.239C126.017 244.04 126.719 242.915 127.174 241.865C127.642 240.802 127.876 239.69 127.876 238.529C127.876 237.194 127.556 236.038 126.916 235.062C126.288 234.086 125.427 233.332 124.331 232.801C123.236 232.269 122.005 232.004 120.639 232.004C119.186 232.004 117.919 232.307 116.836 232.912C115.765 233.505 114.934 234.339 114.343 235.414C113.765 236.49 113.476 237.75 113.476 239.196H109.119C109.119 236.971 109.629 235.019 110.651 233.338C111.672 231.658 113.063 230.348 114.823 229.409C116.596 228.47 118.583 228 120.787 228C123.002 228 124.965 228.47 126.676 229.409C128.387 230.348 129.728 231.615 130.701 233.209C131.673 234.803 132.159 236.576 132.159 238.529C132.159 239.925 131.907 241.29 131.402 242.625C130.91 243.947 130.048 245.424 128.818 247.055C127.599 248.674 125.907 250.651 123.74 252.987L115.248 262.106V262.403H132.824V266.481H108.971Z" />
                  <path d="M153.224 267C150.787 267 148.615 266.58 146.707 265.74C144.812 264.899 143.304 263.731 142.184 262.236C141.076 260.729 140.473 258.98 140.375 256.99H145.027C145.126 258.214 145.544 259.27 146.283 260.16C147.021 261.038 147.987 261.717 149.181 262.199C150.375 262.681 151.698 262.922 153.15 262.922C154.775 262.922 156.215 262.638 157.471 262.069C158.726 261.501 159.711 260.71 160.424 259.697C161.138 258.683 161.495 257.51 161.495 256.175C161.495 254.779 161.151 253.549 160.461 252.486C159.772 251.411 158.763 250.571 157.434 249.965C156.104 249.36 154.48 249.057 152.56 249.057H149.532V244.979H152.56C154.061 244.979 155.378 244.707 156.511 244.163C157.655 243.62 158.548 242.854 159.188 241.865C159.84 240.876 160.166 239.715 160.166 238.38C160.166 237.095 159.883 235.977 159.317 235.025C158.751 234.074 157.951 233.332 156.917 232.801C155.895 232.269 154.689 232.004 153.298 232.004C151.993 232.004 150.763 232.245 149.606 232.727C148.461 233.196 147.526 233.882 146.8 234.784C146.073 235.674 145.679 236.749 145.618 238.01H141.187C141.261 236.02 141.858 234.278 142.978 232.782C144.098 231.275 145.563 230.101 147.372 229.26C149.193 228.42 151.193 228 153.372 228C155.711 228 157.717 228.476 159.391 229.427C161.064 230.366 162.351 231.608 163.249 233.153C164.148 234.698 164.597 236.366 164.597 238.158C164.597 240.296 164.037 242.118 162.917 243.626C161.809 245.134 160.301 246.178 158.394 246.759V247.055C160.781 247.451 162.646 248.47 163.988 250.114C165.329 251.745 166 253.765 166 256.175C166 258.239 165.44 260.092 164.32 261.736C163.212 263.367 161.698 264.652 159.778 265.591C157.858 266.53 155.674 267 153.224 267Z" />
                </svg>
              </div>
              <div className="mt-8 flex w-full flex-col pb-10 lg:mt-0 lg:w-3/5 lg:pl-16 lg:pb-0">
                <h2>
                  <div className="font-input-mono mb-4 inline-block rounded-lg border border-slate-200 bg-white/40 p-4 py-4 px-6 text-xl text-sm font-extrabold leading-none tracking-tight shadow-sm transition hover:bg-white dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:bg-slate-800 sm:text-2xl lg:text-2xl">
                    <span className="sr-only">Announcing Nx Conf on </span>{' '}
                    September 26, 2023
                  </div>
                </h2>
                <h3 className="mb-6">
                  <div className="font-input-mono text-lg">
                    <span role="img" aria-label="globe emoji">
                      🌎
                    </span>{' '}
                    online for free to registered attendees
                  </div>
                  <div className="font-input-mono text-lg">
                    <span role="img" aria-label="location pointer emoji">
                      📍
                    </span>{' '}
                    in-person in New York (invite only){' '}
                  </div>
                </h3>
                <p className="mb-6 sm:text-lg">
                  Talks from the Nx & Nx Cloud teams and selected speakers from
                  the community.
                </p>
                {/* <h2 className="my-6">
                  <div className="font-input-mono mb-4 inline-block rounded-lg border border-slate-200 bg-white/40 p-4 py-4 px-6 text-xl text-sm font-extrabold leading-none tracking-tight shadow-sm transition hover:bg-white dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:bg-slate-800 sm:text-2xl lg:text-2xl">
                    <span className="sr-only">Announcing Nx Conf on </span>{' '}
                    Summit - September 27, 2023
                  </div>
                </h2>
                <h3 className="mb-6">
                  <div className="font-input-mono text-lg">
                    <span role="img" aria-label="location pointer emoji">
                      📍
                    </span>{' '}
                    in-person in New York (invite only){' '}
                  </div>
                </h3>
                <p className="mb-6 sm:text-lg">
                  Roundtable discussions to dive deep into various topics around
                  monorepos and making development faster, more scalable and
                  collaborative.
                </p> */}
                <div className="border-t border-slate-200 dark:border-slate-700">
                  <p className="mb-6 mt-6 sm:text-lg">
                    Registration opening soon! Follow us on{' '}
                    <a
                      href="https://twitter.com/nxdevtools"
                      rel="noreferrer"
                      target="_blank"
                      className="text-blue-500 dark:text-sky-500"
                    >
                      Twitter
                    </a>
                    ,{' '}
                    <a
                      href="https://www.linkedin.com/company/nxdevtools"
                      rel="noreferrer"
                      target="_blank"
                      className="text-blue-500 dark:text-sky-500"
                    >
                      Linkedin
                    </a>{' '}
                    or{' '}
                    <a
                      href="https://go.nrwl.io/nx-newsletter"
                      rel="noreferrer"
                      target="_blank"
                      className="text-blue-500 dark:text-sky-500"
                    >
                      subscribe to our news
                    </a>{' '}
                    to not miss when registration opens.
                  </p>
                </div>

                {/* <a
                  className="font-input-mono group flex w-full items-center text-blue-500 dark:text-sky-500 sm:text-xl"
                  href="https://ti.to/nx-conf/nx-conf-2022?utm_source=nxdev"
                >
                  <span className="group-hover:underline">Register now</span>
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
                </a> */}
                <a
                  rel="noreferrer"
                  target="_blank"
                  href="https://www.youtube.com/watch?v=-g3NABhePJg&utm_source=nx.dev"
                  className="font-input-mono group flex w-full items-center text-blue-500 dark:text-sky-500 sm:text-xl"
                >
                  <span className="group-hover:underline">
                    Watch last year's live replay
                  </span>
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
        <div className="w-full overflow-hidden">
          {/*NAVIGATION*/}
          <div className="hidden border-t border-b border-slate-200 dark:border-slate-700 md:block">
            <div className="mx-auto max-w-screen-lg xl:max-w-screen-xl">
              <div className="font-input-mono grid-cols-7 items-center divide-x divide-slate-200 text-center dark:divide-slate-700 md:grid">
                <div className="p-8">
                  <svg
                    id="nx-conf-logo"
                    className="w-22 inline-block dark:text-white"
                    role="img"
                    viewBox="0 0 446 86"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M407.071 31.4634V84.9512H417.42V31.4634H443.292V22.0244H417.42V17.7244C417.42 14.7878 418.558 12.6902 420.835 11.4317C423.112 10.1033 426.147 9.43902 429.942 9.43902C432.909 9.43902 435.461 9.68374 437.6 10.1732C439.808 10.5927 441.67 11.0472 443.188 11.5366L445.258 2.72683C443.257 2.02764 440.981 1.39837 438.428 0.839023C435.944 0.279675 433.116 0 429.942 0C423.457 0 418.006 1.57317 413.591 4.71951C409.244 7.79593 407.071 12.1659 407.071 17.8293V22.0244H389.478V31.4634H407.071Z" />
                    <path d="M180.934 80.0219C185.556 84.0073 192.386 86 201.424 86C209.427 86 215.567 84.3569 219.845 81.0707C224.122 77.7845 226.503 72.9252 226.986 66.4927L216.844 65.8634C216.637 69.4293 215.257 72.1211 212.704 73.939C210.152 75.687 206.392 76.561 201.424 76.561C195.698 76.561 191.42 75.3724 188.592 72.9951C185.832 70.6179 184.452 67.0171 184.452 62.1927V45.2024C184.452 40.1683 185.832 36.4626 188.592 34.0854C191.351 31.6382 195.56 30.4146 201.217 30.4146C206.254 30.4146 210.048 31.4634 212.601 33.561C215.154 35.6585 216.568 38.8748 216.844 43.2098L226.986 42.5805C226.503 35.5187 224.088 30.1699 219.741 26.5341C215.464 22.8285 209.324 20.9756 201.321 20.9756C192.352 20.9756 185.556 23.0382 180.934 27.1634C176.38 31.2187 174.104 37.2317 174.104 45.2024V62.1927C174.104 70.0236 176.38 75.9667 180.934 80.0219Z" />
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M253.208 79.9171C257.693 83.9724 264.109 86 272.457 86C280.805 86 287.187 83.9724 291.602 79.9171C296.086 75.7919 298.329 69.8837 298.329 62.1927V45.2024C298.329 37.4415 296.086 31.4634 291.602 27.2683C287.187 23.0732 280.839 20.9756 272.56 20.9756C264.212 20.9756 257.796 23.0732 253.312 27.2683C248.827 31.4634 246.585 37.4415 246.585 45.2024V62.1927C246.585 69.8837 248.793 75.7919 253.208 79.9171ZM284.151 72.9951C281.598 75.3724 277.7 76.561 272.457 76.561C267.214 76.561 263.316 75.3724 260.763 72.9951C258.21 70.6179 256.934 67.0171 256.934 62.1927V45.2024C256.934 40.1683 258.21 36.4626 260.763 34.0854C263.316 31.6382 267.214 30.4146 272.457 30.4146C277.7 30.4146 281.598 31.6382 284.151 34.0854C286.704 36.4626 287.98 40.1683 287.98 45.2024V62.1927C287.98 67.0171 286.704 70.6179 284.151 72.9951Z"
                    />
                    <path d="M319.067 84.9512V22.0244H329.415V32.5122H332.52C334.038 28.9463 336.418 26.1496 339.661 24.122C342.903 22.0244 346.594 20.9756 350.734 20.9756C356.943 20.9756 361.841 22.8984 365.429 26.7439C369.017 30.5894 370.81 35.8333 370.81 42.4756V84.9512H360.462V44.5732C360.462 40.1683 359.392 36.8122 357.253 34.5049C355.184 32.1276 352.183 30.939 348.25 30.939C345.145 30.939 341.972 31.8829 338.729 33.7707C335.556 35.6585 332.451 38.3854 329.415 41.9512V84.9512H319.067Z" />
                    <path d="M0 21.9504V84.8056H10.3081V41.8545C13.3318 38.2927 16.4243 35.569 19.5854 33.6833C22.8153 31.7977 25.9765 30.8549 29.0689 30.8549C32.986 30.8549 35.9753 32.0421 38.037 34.4166C40.1673 36.7213 41.2325 40.0736 41.2325 44.4735V84.8056H51.5406V42.3783C51.5406 35.7436 49.7539 30.5056 46.1804 26.6645C42.6069 22.8234 37.7277 20.9028 31.5429 20.9028C27.4196 20.9028 23.743 21.9504 20.5132 24.0455C17.2833 26.0709 14.9124 28.8644 13.4006 32.4262H10.3081V21.9504H0Z" />
                    <path d="M97.3489 60.8158L113.327 84.8056H124.872L103.431 52.7494L125.284 21.9504H113.842L98.2767 44.9973L82.9176 21.9504H71.3725L92.298 53.2732L70.6509 84.8056H82.0929L97.3489 60.8158Z" />
                  </svg>
                </div>
                <Link
                  href="#agenda"
                  className="cursor-pointer bg-white/40 py-8 transition hover:bg-white dark:bg-slate-800/60 dark:hover:bg-slate-800"
                >
                  Agenda
                </Link>
                <Link
                  href="#speakers"
                  className="cursor-pointer bg-white/40 py-8 transition hover:bg-white dark:bg-slate-800/60 dark:hover:bg-slate-800"
                >
                  Speakers
                </Link>
                {/* <Link
                  href="#workshop"
                  className="cursor-pointer bg-white/40 py-8 transition hover:bg-white dark:bg-slate-800/60 dark:hover:bg-slate-800"
                >
                  Workshop
                </Link> */}
                <Link
                  href="#location"
                  className="cursor-pointer bg-white/40 py-8 transition hover:bg-white dark:bg-slate-800/60 dark:hover:bg-slate-800"
                >
                  Location
                </Link>
                <Link
                  href="#code-of-conduct"
                  className="cursor-pointer bg-white/40 py-8 transition hover:bg-white dark:bg-slate-800/60 dark:hover:bg-slate-800"
                >
                  CoC
                </Link>
              </div>
            </div>
          </div>
          {/*AGENDA*/}
          <div className="mx-auto max-w-screen-lg px-5 py-5 xl:max-w-screen-xl">
            <div className="mt-24">
              <h2 id="agenda" className="font-input-mono my-20 text-3xl">
                Agenda{' '}
                <span className="text-base italic">(New York - UTC-04:00)</span>
              </h2>
            </div>
          </div>
          <ConfScheduleShort />
          {/*SPEAKERS*/}
          <div className="mx-auto max-w-screen-lg px-5 py-5 xl:max-w-screen-xl">
            <div className="mt-24">
              <h2 id="speakers" className="font-input-mono my-20 text-3xl">
                Speakers
              </h2>
            </div>
          </div>
          <ConfSpeakers />
          {/*WORKSHOP*/}
          {/* <div className="mx-auto max-w-screen-lg px-5 py-5 xl:max-w-screen-xl">
            <div className="mt-24">
              <h2 id="workshop" className="font-input-mono my-20 text-3xl">
                Workshop
              </h2>
            </div>
          </div>
          <ConfWorkshop /> */}
          {/*LOCATION*/}
          <div className="mx-auto max-w-screen-lg px-5 py-5 xl:max-w-screen-xl">
            <div className="mt-24">
              <h2 id="location" className="font-input-mono my-20 text-3xl">
                Location
              </h2>
            </div>
          </div>
          <ConfLocation />
          {/*HEALTH AND SAFETY*/}
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
          <ConfHealthAndSafety />
          {/*SPONSORS
        <div className="mx-auto max-w-screen-lg px-5 py-5 xl:max-w-screen-xl">
          <div className="mt-24">
            <h2 id="sponsors" className="font-input-mono my-20 text-3xl">
              Sponsors
            </h2>
          </div>
        </div>
        <ConfSponsors />*/}
          {/*<div className="mx-auto max-w-screen-lg px-5 py-5 xl:max-w-screen-xl">
          SPONSORS
          <div className="my-24">
            <h2 id="sponsors" className="my-20 text-3xl font-input-mono">
              Sponsors
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-8">
              <div>
                <svg viewBox="0 0 262 163" className="w-16">
                  <polygon
                    id="Path"
                    fill="#ffffff"
                    points="130.68 104.59 97.49 52.71 97.44 96.3 40.24 0 0 0 0 162.57 39.79 162.57 39.92 66.39 96.53 158.26"
                  />
                  <polygon
                    id="Path"
                    fill="#ffffff"
                    points="97.5 41.79 137.24 41.79 137.33 41.33 137.33 0 97.54 0 97.49 41.33"
                  />
                  <path
                    d="M198.66,86.86 C189.139872,86.6795216 180.538723,92.516445 177.19,101.43 C182.764789,93.0931021 193.379673,89.7432211 202.73,93.37 C207.05,95.13 212.73,97.97 217.23,96.45 C212.950306,90.4438814 206.034895,86.8725952 198.66,86.86 L198.66,86.86 Z"
                    id="Path"
                    fill="#96D8E9"
                  />
                  <path
                    d="M243.75,106.42 C243.75,101.55 241.1,100.42 235.6,98.42 C231.52,97 226.89,95.4 223.52,91 C222.86,90.13 222.25,89.15 221.6,88.11 C220.14382,85.4164099 218.169266,83.037429 215.79,81.11 C212.58,78.75 208.37,77.6 202.91,77.6 C191.954261,77.6076705 182.084192,84.2206169 177.91,94.35 C183.186964,87.0278244 191.956716,83.0605026 200.940147,83.9314609 C209.923578,84.8024193 217.767888,90.3805017 221.54,98.58 C223.424615,101.689762 227.141337,103.174819 230.65,102.22 C236.02,101.07 235.65,106.15 243.76,107.87 L243.75,106.42 Z"
                    id="Path"
                    fill="#48C4E5"
                  />
                  <path
                    d="M261.46,105.38 L261.46,105.27 C261.34,73.03 235.17,45.45 202.91,45.45 C183.207085,45.4363165 164.821777,55.3450614 154,71.81 L153.79,71.45 L137.23,45.45 L97.5,45.4499858 L135.25,104.57 L98.41,162.57 L137,162.57 L153.79,136.78 L170.88,162.57 L209.48,162.57 L174.48,107.49 C173.899005,106.416838 173.583536,105.220114 173.56,104 C173.557346,96.2203871 176.64661,88.7586448 182.147627,83.2576275 C187.648645,77.7566101 195.110387,74.6673462 202.89,74.67 C219.11,74.67 221.82,84.37 225.32,88.93 C232.23,97.93 246.03,93.99 246.03,105.73 L246.03,105.73 C246.071086,108.480945 247.576662,111.001004 249.979593,112.340896 C252.382524,113.680787 255.317747,113.636949 257.679593,112.225896 C260.041438,110.814842 261.471086,108.250945 261.43,105.5 L261.43,105.5 L261.43,105.38 L261.46,105.38 Z"
                    id="Path"
                    fill="#ffffff"
                  />
                  <path
                    d="M261.5,113.68 C261.892278,116.421801 261.504116,119.218653 260.38,121.75 C258.18,126.84 254.51,125.14 254.51,125.14 C254.51,125.14 251.35,123.6 253.27,120.65 C255.4,117.36 259.61,117.74 261.5,113.68 Z"
                    id="Path"
                    fill="#022f56"
                  />
                </svg>
              </div>
              <div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 402.35 125.53"
                >
                  <g id="Layer_2" data-name="Layer 2">
                    <g id="Layer_1-2" data-name="Layer 1">
                      <g
                        id="Color_on_white_horizontal"
                        data-name="Color on white horizontal"
                      >
                        <g id="LOGO">
                          <polygon
                            points="123.6 110.85 123.6 125.53 146.69 125.53 146.69 113.02 123.6 110.85"
                            fill="#fff"
                          />
                          <g id="whale">
                            <g id="bdy">
                              <path
                                id="tusk"
                                d="M91.09,105.22a3,3,0,0,1,3-3h.27a1.86,1.86,0,0,1,.63.12L165.45,115l-71.81-6.75h0A3,3,0,0,1,91.09,105.22Z"
                                fill="#48c4e5"
                              />
                              <path
                                d="M124,50.79h-.19C119,50,114.3,46.49,112.7,42h0a57.4,57.4,0,1,0-72.37,70.24A74.28,74.28,0,0,0,90.41,109c3.78-1.79,4.45-4.63,4.45-6.48s-1.64-3.07-2.24-3.89a2.25,2.25,0,0,1-.54-1.18h0a27.51,27.51,0,0,0-27.44-25.6H62.87a23.35,23.35,0,0,1-16.68-39.7,30.15,30.15,0,0,1,22-9.42A30.57,30.57,0,0,1,97.76,45.39a15.33,15.33,0,0,1-9.11,5.36A15.15,15.15,0,0,0,76.31,63.29c5.88,0,9.79,8,20.71,8a9.9,9.9,0,0,0,9.18-6.16,9.93,9.93,0,0,0,9.19,6.16,19.63,19.63,0,0,0,8.56-1.9Zm-64.79,48c.35-1.46,1.52-.84,3.06-.46s2.86.36,2.51,1.81a2.87,2.87,0,0,1-5.57-1.35Z"
                                fill="#48c4e5"
                              />
                              <g id="right_fin" data-name="right fin">
                                <path
                                  d="M52.51,69.4A9.4,9.4,0,0,1,60.85,62h0A8.43,8.43,0,0,0,64,68.72,8.45,8.45,0,0,1,67,72v3H52.51Z"
                                  fill="#48c4e5"
                                />
                              </g>
                            </g>
                            <g id="highlights">
                              <path
                                d="M12.9,93.81A57.61,57.61,0,0,1,43.37,1.7C24.74,7,3.9,24,3.9,53.7c0,37.66,31.34,45,45.91,51.72,8.85,4.11,12,7.56,13.19,9.64H60.84a73.74,73.74,0,0,1-20.51-2.88c-6.84-2.07-14.65-6.64-20.1-10.93.77.11-3.85-2.6-8.39-8.82"
                                fill="#96d8e9"
                              />
                              <ellipse
                                cx="24.58"
                                cy="61.18"
                                rx="1.95"
                                ry="2.79"
                                transform="translate(-13.17 7.12) rotate(-13.04)"
                                fill="#96d8e9"
                              />
                              <ellipse
                                cx="32.38"
                                cy="72.47"
                                rx="2.56"
                                ry="3.66"
                                transform="translate(-38.68 37.09) rotate(-39.46)"
                                fill="#96d8e9"
                              />
                              <ellipse
                                cx="31.51"
                                cy="47.37"
                                rx="2.79"
                                ry="1.95"
                                transform="translate(-17.99 75.41) rotate(-85.89)"
                                fill="#96d8e9"
                              />
                              <ellipse
                                cx="24.79"
                                cy="51"
                                rx="0.98"
                                ry="1.4"
                                transform="translate(-2.13 1.09) rotate(-2.42)"
                                fill="#96d8e9"
                              />
                              <path
                                id="left_fin"
                                data-name="left fin"
                                d="M38.21,105.63a28.73,28.73,0,0,1-15,7.18q-1.22.18-2.46.27A28.61,28.61,0,0,1,16,113h0a35,35,0,0,0-5.7-.1,33.41,33.41,0,0,0-9.48,2h0A11.66,11.66,0,0,1,11,99a11.45,11.45,0,0,1,6.55,1.5h0A11.92,11.92,0,0,0,24,102.06a11.51,11.51,0,0,0,5.8-2s1.34-1.17,4.5.87C38.92,103.91,38.21,105.63,38.21,105.63Z"
                                fill="#96d8e9"
                              />
                            </g>
                          </g>
                          <polygon
                            points="179.78 43.53 179.78 87.23 143 43.53 123.6 43.53 123.6 103.07 146.69 108.53 146.69 81.84 183.47 125.53 202.87 125.53 202.87 43.53 179.78 43.53"
                            fill="#fff"
                          />
                          <path
                            d="M244.5,63.16A34.49,34.49,0,0,1,257.18,61V81a49.24,49.24,0,0,0-5.15-.3q-7.26,0-11.37,3.86t-4.08,11.84v29.16H214V62h21.54v7.62A21,21,0,0,1,244.5,63.16Z"
                            fill="#fff"
                          />
                          <path
                            d="M362.19,62l-18.35,63.49h-21.9l-7.53-29.1-8,29.1h-21.9L266.16,62h21.43l8.59,32.06L305.25,62h19.28l8.71,32.41L342.31,62Z"
                            fill="#fff"
                          />
                          <path
                            d="M393.31,28.61H370.64v74c0,19.88,12.84,22.41,24.89,22.41,3.67,0,6.82-.35,6.82-.35V107.41s-1.31.12-2.75.12c-5.11,0-6.29-2-6.29-7.59Z"
                            fill="#fff"
                          />
                        </g>
                      </g>
                    </g>
                  </g>
                </svg>
              </div>
            </div>
          </div>
        </div>*/}
        </div>
      </main>
      <Footer />
      <Script
        id="twitter-campain-pixelcode"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
        !function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);
        },s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
        a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
        twq('config','obtp4'); 
        `,
        }}
      />
    </>
  );
}

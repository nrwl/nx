import Link from 'next/link';

export function LaunchNxIntro() {
  return (
    <div className="mx-auto max-w-screen-lg px-5 py-5 xl:max-w-screen-xl">
      <div className="mt-24 flex flex-col items-start py-48 lg:flex-row">
        <div className="relative mt-8 flex w-full flex-col pb-10 lg:mt-0 lg:w-2/5 lg:pb-0">
          <svg
            id="launch-nx-logo"
            className="-left-60 -top-60 w-full dark:text-white"
            width="290"
            height="268"
            viewBox="0 0 76 53"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M29.754 66.7h-1.037v-8.578h1.037zm6.835 0h-1.031v-.657q-.138.094-.375.265-.232.165-.452.264-.26.127-.595.21-.337.088-.789.088-.832 0-1.41-.551-.58-.551-.58-1.406 0-.7.298-1.13.303-.435.86-.683.562-.248 1.35-.337.789-.088 1.693-.132v-.16q0-.352-.127-.584-.121-.231-.353-.364-.22-.127-.529-.17-.309-.045-.645-.045-.408 0-.91.11-.501.105-1.036.31h-.055v-1.054q.303-.082.877-.182.573-.099 1.13-.099.65 0 1.13.11.485.105.838.364.347.254.529.656.182.403.182.998zm-1.031-1.517V63.47q-.474.028-1.12.083-.639.055-1.013.16-.447.126-.722.396-.276.265-.276.734 0 .529.32.799.32.264.975.264.546 0 .998-.21.452-.214.838-.512zm8.13 1.516h-1.036v-.683q-.524.413-1.003.634-.48.22-1.059.22-.97 0-1.51-.59-.54-.595-.54-1.742v-3.996h1.036v3.506q0 .468.044.805.044.33.188.567.149.243.386.353.237.11.689.11.402 0 .876-.21.48-.209.893-.534v-4.597h1.036zm7.188 0H49.84v-3.506q0-.424-.05-.793-.05-.375-.182-.585-.138-.231-.397-.341-.259-.116-.672-.116-.425 0-.888.21-.463.209-.887.534v4.597h-1.036v-6.157h1.036v.684q.485-.403 1.003-.629.518-.226 1.064-.226.998 0 1.521.601.524.6.524 1.73zm6.549-.386q-.519.248-.987.386-.463.138-.987.138-.667 0-1.224-.193-.556-.198-.953-.595-.403-.397-.623-1.003-.22-.607-.22-1.417 0-1.51.826-2.37.833-.86 2.194-.86.53 0 1.036.149.513.148.938.363v1.152h-.056q-.474-.369-.98-.567-.502-.199-.982-.199-.882 0-1.394.596-.508.59-.508 1.736 0 1.113.496 1.714.502.595 1.406.595.314 0 .64-.082.325-.083.584-.215.226-.116.424-.243.199-.132.314-.226h.056zm6.476.386h-1.036v-3.506q0-.424-.05-.793-.05-.375-.181-.585-.138-.231-.397-.341-.26-.116-.673-.116-.424 0-.887.21-.463.209-.888.534v4.597h-1.036v-8.577h1.036v3.104q.485-.403 1.003-.629.519-.226 1.064-.226.998 0 1.522.601.523.6.523 1.73zM33.855 75.65h-1.037v-3.507q0-.424-.05-.793-.049-.375-.181-.585-.138-.231-.397-.341-.26-.116-.673-.116-.424 0-.887.21-.463.209-.888.534v4.597h-1.036v-6.157h1.036v.684q.486-.403 1.004-.629.518-.226 1.064-.226.997 0 1.52.601.525.6.525 1.73zm7.325 0h-1.306l-1.748-2.366-1.758 2.365h-1.207l2.403-3.07-2.381-3.087h1.306l1.737 2.326 1.742-2.326h1.212l-2.42 3.032z"
              transform="matrix(2.18053 0 0 2.18053 -62.546 -126.737)"
            />
            <path
              d="m31.137 77.666-1.976 5.126h-.477l1.968-5.126zm4.343.501h-.027q-.086-.024-.224-.05-.137-.027-.242-.027-.334 0-.485.149-.149.146-.149.532v.105h.934v.435h-.917v2.643h-.519v-2.643h-.35v-.435h.35v-.102q0-.549.273-.84.273-.296.788-.296.174 0 .312.017.14.016.256.038zm2.905 2.302h-2.268q0 .284.085.496.086.21.235.344.143.133.339.199.198.066.435.066.314 0 .631-.124.32-.127.455-.248h.028v.565q-.262.11-.535.184-.273.075-.573.075-.767 0-1.197-.414-.43-.416-.43-1.18 0-.754.411-1.198.414-.444 1.086-.444.623 0 .96.364.338.364.338 1.034zm-.504-.397q-.003-.408-.207-.631-.201-.224-.615-.224-.416 0-.664.246-.245.245-.278.609zm3.999.32q0 .385-.11.694-.108.309-.293.518-.195.218-.43.328-.234.108-.515.108-.262 0-.457-.064-.196-.06-.386-.165l-.033.143h-.485v-4.288h.518v1.532q.217-.179.463-.292.245-.116.551-.116.546 0 .86.42.317.418.317 1.182zm-.535.013q0-.55-.182-.835-.182-.286-.587-.286-.226 0-.457.099-.232.096-.43.25v1.764q.22.1.377.138.16.039.361.039.43 0 .673-.281.245-.284.245-.888zm6.039 1.55h-2.778v-.577l.578-.496q.293-.248.543-.493.53-.513.725-.813.196-.303.196-.653 0-.32-.212-.5-.21-.181-.587-.181-.251 0-.543.088-.293.088-.57.27h-.028v-.579q.195-.096.52-.176.328-.08.634-.08.632 0 .99.306.358.303.358.824 0 .234-.06.438-.058.201-.174.383-.108.171-.254.337-.143.165-.35.366-.295.29-.609.562-.314.27-.587.502h2.208zm3.583-2.054q0 1.105-.348 1.623-.344.516-1.072.516-.738 0-1.08-.524-.34-.524-.34-1.61 0-1.094.345-1.615.345-.523 1.075-.523.739 0 1.078.532.342.529.342 1.6zm-.725 1.251q.096-.223.13-.523.035-.304.035-.728 0-.419-.036-.728-.033-.308-.132-.523-.096-.213-.265-.32-.165-.108-.427-.108-.259 0-.43.108-.168.107-.267.325-.094.204-.13.532-.033.328-.033.72 0 .43.03.719.031.29.13.518.091.215.257.328.168.113.443.113.26 0 .43-.108.171-.107.265-.325zm4.319.802h-2.779v-.576l.58-.496q.291-.248.542-.493.53-.513.725-.813.196-.303.196-.653 0-.32-.213-.5-.209-.181-.587-.181-.25 0-.543.088-.292.088-.57.27h-.028v-.579q.196-.096.521-.176.328-.08.634-.08.631 0 .99.306.358.303.358.824 0 .234-.06.438-.059.201-.174.383-.108.171-.254.337-.143.165-.35.366-.295.29-.609.562-.314.27-.587.502h2.208zm3.682-1.155h-.61v1.155h-.529V80.8H55.14v-.633l1.987-2.316h.508v2.508h.609zm-1.139-.44v-1.853l-1.59 1.852z"
              transform="matrix(2.18053 0 0 2.18053 -62.546 -126.737)"
            />
          </svg>
        </div>
        <div className="mt-8 flex w-full flex-col pb-10 lg:mt-0 lg:w-3/5 lg:pb-0 lg:pl-16">
          <h2>
            <div className="font-input-mono mb-4 inline-block rounded-lg border border-slate-200 bg-white/40 p-4 px-6 py-4 text-sm text-xl font-extrabold leading-none tracking-tight shadow-sm transition hover:bg-white sm:text-2xl lg:text-2xl dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:bg-slate-800">
              <span className="sr-only">Announcing Launch Nx on </span> February
              5-9, 2024
            </div>
          </h2>
          <h3 className="mb-6">
            <div className="font-input-mono text-lg">
              <span role="img" aria-label="globe emoji">
                🌎
              </span>{' '}
              online and free to attend
            </div>
          </h3>
          <p className="mb-6 sm:text-lg">
            Missed our Launch Nx Conf? Then follow up with the{' '}
            <Link href="#announcements" className="underline">
              announcements
            </Link>{' '}
            below or watch the conference recording:
          </p>

          <a
            href="#conf"
            className="font-input-mono group flex w-full items-center text-blue-500 sm:text-xl dark:text-sky-500"
          >
            <span className="group-hover:underline">Watch the talks</span>
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
            rel="noreferrer"
            target="_blank"
            href="https://youtu.be/fy0K2Smyj5A"
            className="font-input-mono group flex w-full items-center text-blue-500 sm:text-xl dark:text-sky-500"
          >
            <span className="group-hover:underline">
              Watch the full conference recording
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

          <div className="mt-5 border-t border-slate-200 dark:border-slate-700">
            <p className="mb-6 mt-6 sm:text-lg">
              Follow us on{' '}
              <a
                href="https://twitter.com/nxdevtools"
                rel="noreferrer"
                target="_blank"
                className="text-blue-500 dark:text-sky-500"
              >
                X
              </a>
              ,{' '}
              <a
                href="https://www.linkedin.com/company/nxdevtools"
                rel="noreferrer"
                target="_blank"
                className="text-blue-500 dark:text-sky-500"
              >
                Linkedin
              </a>
              ,{' '}
              <a
                href="https://youtube.com/@nxdevtools"
                rel="noreferrer"
                target="_blank"
                className="text-blue-500 dark:text-sky-500"
              >
                Youtube
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
              to not miss any updates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

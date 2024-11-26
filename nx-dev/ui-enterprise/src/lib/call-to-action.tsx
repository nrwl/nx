import Link from 'next/link';

export function CallToAction(): JSX.Element {
  return (
    <section className="relative isolate px-6 py-32 sm:py-40 lg:px-8">
      <svg
        className="absolute inset-0 -z-10 h-full w-full stroke-black/10 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)] dark:stroke-white/10"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="1d4240dd-898f-445f-932d-e2872fd12de3"
            width={200}
            height={200}
            x="50%"
            y={0}
            patternUnits="userSpaceOnUse"
          >
            <path d="M.5 200V.5H200" fill="none" />
          </pattern>
        </defs>
        <svg
          x="50%"
          y={0}
          className="overflow-visible fill-slate-200/20 dark:fill-slate-800/20"
        >
          <path
            d="M-200 0h201v201h-201Z M600 0h201v201h-201Z M-400 600h201v201h-201Z M200 800h201v201h-201Z"
            strokeWidth={0}
          />
        </svg>
        <rect
          width="100%"
          height="100%"
          strokeWidth={0}
          fill="url(#1d4240dd-898f-445f-932d-e2872fd12de3)"
        />
      </svg>
      <div
        className="absolute inset-x-0 top-10 -z-10 flex transform-gpu justify-center overflow-hidden blur-3xl"
        aria-hidden="true"
      >
        <div
          className="aspect-[1108/632] w-[69.25rem] flex-none bg-gradient-to-r from-[#80caff] to-[#4f46e5] opacity-20"
          style={{
            clipPath:
              'polygon(73.6% 51.7%, 91.7% 11.8%, 100% 46.4%, 97.4% 82.2%, 92.5% 84.9%, 75.7% 64%, 55.3% 47.5%, 46.5% 49.4%, 45% 62.9%, 50.3% 87.2%, 21.3% 64.1%, 0.1% 100%, 5.4% 51.1%, 21.4% 63.9%, 58.9% 0.2%, 73.6% 51.7%)',
          }}
        />
      </div>
      <div className="mx-auto max-w-2xl text-center">
        <h2
          id="cta"
          className="text-3xl font-medium tracking-tight text-slate-950 sm:text-5xl dark:text-white"
        >
          Your organization's transformation
          <br />
          starts now
        </h2>
        <div className="mt-10">
          <Link
            href="/contact/engineering"
            title="Talk to the engineering team"
            className="rounded-md bg-slate-950 px-3.5 py-2.5 text-sm font-semibold text-slate-100 shadow-sm hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            prefetch={false}
          >
            Talk to engineering
          </Link>
          <p className="mt-6 italic">
            Ready to talk terms?{' '}
            <Link
              href="/contact/sales"
              title="Talk to the sales team"
              className="font-semibold underline"
              prefetch={false}
            >
              Speak directly to sales
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}

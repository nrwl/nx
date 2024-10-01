import { CheckIcon } from '@heroicons/react/24/outline';
import { ButtonLink } from '@nx/nx-dev/ui-common';
import Link from 'next/link';

const features = [
  'White glove onboarding',
  'Work hand-in-hand with the Nx team for continual improvement',
  'Run on the Nx Cloud servers in any region or run fully self-contained, on-prem',
  'Premium Support and SLAs available',
  'SSO / SAML Login',
];

export function EnterprisePlan({
  cta = 'Learn more',
  url,
}: {
  cta?: string;
  url: string;
}) {
  return (
    <article className="relative rounded-b-xl bg-slate-50/60 py-4 ring-1 ring-slate-200 xl:py-6 dark:bg-slate-800/60 dark:ring-slate-800">
      <h4
        id="on-prem"
        className="absolute -top-9 left-0 w-full rounded-t-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 p-2 text-center text-sm font-medium text-white shadow-inner ring-1 ring-slate-200 dark:ring-slate-800"
      >
        Available as an on-prem solution
      </h4>
      <header className="flex items-center justify-between gap-x-4 px-4 xl:px-6">
        <h3
          id="enterprise-plan"
          className="text-xl font-semibold leading-8 text-slate-900 dark:text-slate-100"
        >
          Enterprise
        </h3>
      </header>
      <p className="mt-4 h-12 px-4 text-sm leading-6 xl:px-6">
        The ultimate Nx toolchain, tailored to your needs of speed.
      </p>
      <p className="mt-12 flex items-baseline gap-x-1">&nbsp;</p>
      <div className="p-4 xl:p-6">
        <ButtonLink
          href={url}
          aria-describedby="enterprise-plan"
          title="Enterprise"
          size="default"
          variant="secondary"
          className="w-full"
        >
          {cta}
        </ButtonLink>
      </div>
      <p className="border-b border-t border-slate-100 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 xl:px-6 dark:border-slate-800 dark:bg-green-500/10 dark:text-green-400">
        Volume discounts on credits available.
      </p>
      <ul className="space-y-3 px-4 py-6 text-sm leading-6 text-slate-500 xl:px-6 dark:text-slate-400">
        <li className="text-base font-medium text-slate-700 dark:text-slate-300">
          The complete Nx toolchain tailored to your needs:
        </li>
        {features.map((feature) => (
          <li key={feature} className="flex gap-x-3">
            <CheckIcon
              className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
              aria-hidden="true"
            />
            {feature}
          </li>
        ))}
        <li className="flex gap-x-3">
          <CheckIcon
            className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
            aria-hidden="true"
          />
          <p>
            <Link
              href="/ci/features/explain-with-ai"
              title="Learn more about Explain with AI"
              prefetch={false}
              className="font-medium text-slate-700 underline dark:text-slate-300"
            >
              Explain with AI
            </Link>
            : provide detailed explanations and insights for failed task
            outputs.
          </p>
        </li>
        <li className="flex gap-x-3">
          <CheckIcon
            className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
            aria-hidden="true"
          />
          <p>
            <Link
              href="/powerpack"
              title="Learn more about Nx Powerpack"
              prefetch={false}
              className="font-medium text-slate-700 underline dark:text-slate-300"
            >
              Nx Powerpack
            </Link>
            : a suite of premium extensions for the Nx CLI specifically designed
            for enterprises.
          </p>
        </li>
      </ul>
    </article>
  );
}

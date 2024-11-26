import { Footer } from './footer';
import { Header } from './headers/header';
import { PropsWithChildren } from 'react';
import cx from 'classnames';

export function DefaultLayout({
  isHome = false,
  children,
}: { isHome?: boolean } & PropsWithChildren): JSX.Element {
  return (
    <div className="w-full overflow-hidden dark:bg-slate-950">
      <Header />
      <div className="relative isolate">
        <div
          className="absolute inset-x-0 -top-40 -z-10 h-full transform-gpu overflow-hidden blur-3xl sm:-top-80"
          aria-hidden="true"
        >
          <div
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[46.125rem] -translate-x-1/2 rotate-[35deg] bg-gradient-to-tr from-[#9333ea] to-[#3b82f6] opacity-25 sm:left-[calc(70%-30rem)] sm:w-[92.1875rem] dark:from-[#3b82f6] dark:to-[#9333ea] dark:opacity-15"
            style={{
              clipPath:
                'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 95.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 67.5% 76.7%, 0.1% 64.9%, 77.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 84.1% 44.1%)',
            }}
          />
        </div>
        <main className={isHome ? '' : 'py-24 sm:py-32'}>{children}</main>
      </div>
      <Footer />
    </div>
  );
}

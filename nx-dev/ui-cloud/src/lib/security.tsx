import {
  ButtonLink,
  SectionDescription,
  SectionHeading,
  Strong,
} from '@nx/nx-dev/ui-common';
import { ReactElement } from 'react';

export function Security(): ReactElement {
  return (
    <section id="security" className="relative isolate">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-16 lg:flex-row lg:items-center lg:gap-20">
          <div className="max-w-md">
            <SectionHeading as="h2" variant="title" id="security-title">
              The Only Secure Multi-Tier Cache.
            </SectionHeading>
            <SectionDescription as="p" className="mt-6">
              Nx Cloud is certified to industry standards, is constantly
              monitored, and{' '}
              <a
                href="https://security.nx.app/"
                target="_blank"
                rel="nofollow noreferrer"
                className="underline"
              >
                issues security trust reports powered by Vanta
              </a>
              .
            </SectionDescription>
          </div>
          <div className="w-full flex-auto">
            <SectionHeading as="p" variant="subtitle">
              Generic CI tools offer vague security promises. We provide a
              concrete, provable solution.{' '}
              <Strong>
                Nx Cloud is the only CI platform with a secure, multi-tiered
                remote cache
              </Strong>{' '}
              designed for and trusted by organizations in finance, healthcare,
              and other regulated industries. Don't compromise.
            </SectionHeading>
            <div className="mt-8 flex flex-wrap items-center gap-4 md:gap-8">
              <div className="flex w-52 shrink-0 items-center gap-2 rounded-xl px-2 py-1 text-xs text-slate-950 ring-1 ring-slate-200 dark:text-slate-50 dark:ring-slate-700">
                <svg
                  role="img"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 64 64"
                  fill="currentColor"
                  stroke="currentColor"
                  className="h-12 w-12 shrink-0"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M30.3555 27.3511C33.6089 27.3511 33.92 24.24 33.9822 23.4933H32.3644C32.3022 24.1244 32.0711 25.9555 30.3911 25.9555C28.5066 25.9555 28.2133 23.1289 28.2133 20.5511C28.2133 17.9733 28.5333 15.3066 30.48 15.3066C32.24 15.3066 32.3378 17.2533 32.3378 17.6978H33.9466C33.9111 16.8533 33.7155 13.8933 30.5067 13.8933C27.5822 13.8933 26.5422 16.6578 26.5422 20.5422C26.5422 23.7511 26.8 27.3511 30.3555 27.3511ZM14.6755 27.1466L15.5644 23.1644H18.9067L19.7955 27.1466H21.4933L18.2844 14.0889H16.1955L13.0667 27.1466H14.6755ZM18.2599 20.4008C18.3572 20.8256 18.4603 21.2755 18.5689 21.7511H15.8755L16.0659 20.8927L16.0659 20.8927L16.0659 20.8927L16.0659 20.8927C16.5862 18.5487 17.0136 16.6232 17.1644 15.5911H17.2178C17.368 16.5078 17.728 18.0788 18.2599 20.4008L18.2599 20.4008ZM24.48 14.0889V27.1466H22.8711V14.0889H24.48ZM35.6978 14.0889H39.1733C41.2355 14.0889 42.7289 15.3778 42.7289 17.7689C42.7289 20.16 41.4222 21.5644 39.0044 21.5644H37.3333V27.1466H35.7333L35.6978 14.0889ZM38.8267 20.2311H37.3333V15.4311H38.9867C40.3644 15.4311 41.1022 16.3378 41.1022 17.7511C41.1022 19.4311 40.3466 20.2311 38.8267 20.2311ZM45.0044 23.1644L44.1155 27.1466H42.5067L45.6355 14.0889H47.7244L50.9333 27.1466H49.2355L48.3466 23.1644H45.0044ZM47.7948 20.8643L48 21.7511H45.2978L45.4882 20.8926L45.4883 20.8921L45.4884 20.8915C46.0086 18.5481 46.4358 16.623 46.5866 15.5911H46.64C46.8001 16.5676 47.198 18.2864 47.7948 20.8643ZM20.7378 46.7733C20.8444 48.0622 21.4489 49.1111 22.8355 49.1111C24.2222 49.1111 24.8089 48.3733 24.8089 46.9689C24.8089 45.5644 24.2578 44.9422 22.4978 44.0978C20.4444 43.1022 19.5555 42.1866 19.5555 40.2844C19.5036 39.3854 19.8439 38.508 20.4883 37.8789C21.1327 37.2499 22.018 36.9309 22.9155 37.0044C25.52 37.0044 26.2044 38.8444 26.2489 40.4089H24.6311C24.5689 39.7511 24.3733 38.32 22.8533 38.32C22.3703 38.2922 21.9 38.481 21.5701 38.8349C21.2403 39.1888 21.085 39.6712 21.1467 40.1511C21.1467 41.3422 21.68 41.9289 23.2978 42.6666C25.5911 43.76 26.4711 44.8355 26.4711 46.8266C26.552 47.8159 26.1903 48.7902 25.4833 49.4869C24.7763 50.1836 23.7968 50.531 22.8089 50.4355C20.1422 50.4355 19.2533 48.6578 19.1467 46.7733H20.7378ZM31.7155 50.4444C34.5778 50.4444 35.6889 48.1155 35.6889 43.6C35.6889 39.1555 34.5244 36.9955 31.7867 36.9955C29.2 36.9955 27.84 39.0489 27.84 43.6178C27.84 48.1866 29.0489 50.4444 31.7155 50.4444ZM29.4667 43.6C29.4667 47.2089 30.1689 49.0844 31.7422 49.0844C33.3155 49.0844 34.0089 47.3066 34.0089 43.6266C34.0089 39.9466 33.3155 38.4 31.7244 38.4C30.1333 38.4 29.4933 40.1511 29.4933 43.5555L29.4667 43.6ZM41.1911 50.4444C44.4444 50.4444 44.7644 47.3333 44.8178 46.5955H43.2C43.1467 47.2711 42.9067 49.0489 41.2267 49.0489C39.3422 49.0489 39.0489 46.2844 39.0489 43.6533C39.0489 41.0222 39.3689 38.4 41.3244 38.4C43.0755 38.4 43.1733 40.3466 43.1733 40.7911H44.7822C44.7467 39.9466 44.5511 36.9955 41.3511 36.9955C38.4267 36.9955 37.3778 39.7511 37.3778 43.6355C37.3778 46.8889 37.6355 50.4444 41.1911 50.4444Z"
                  />
                  <path
                    d="M12.8622 32H51.1378"
                    strokeWidth="1.33333"
                    strokeLinejoin="round"
                  />
                </svg>
                SSAE18/SOC 2 type 1 and type 2 reports
              </div>
              <ButtonLink
                title="Learn more about security"
                href="/enterprise/security"
                variant="secondary"
                size="default"
              >
                Learn why Nx Cloud can be trusted
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
      <div
        className="absolute inset-x-0 -top-16 -z-10 flex transform-gpu justify-center overflow-hidden blur-3xl"
        aria-hidden="true"
      >
        <div
          className="aspect-[1318/752] w-[82.375rem] flex-none bg-gradient-to-r from-[#80caff] to-[#4f46e5] opacity-5"
          style={{
            clipPath:
              'polygon(73.6% 51.7%, 91.7% 11.8%, 100% 46.4%, 97.4% 82.2%, 92.5% 84.9%, 75.7% 64%, 55.3% 47.5%, 46.5% 49.4%, 45% 62.9%, 50.3% 87.2%, 21.3% 64.1%, 0.1% 100%, 5.4% 51.1%, 21.4% 63.9%, 58.9% 0.2%, 73.6% 51.7%)',
          }}
        />
      </div>
    </section>
  );
}

import {
  ArrowUpRightIcon,
  ChevronRightIcon,
  ComputerDesktopIcon,
  DocumentIcon,
  MicrophoneIcon,
  NewspaperIcon,
} from '@heroicons/react/24/outline';
import {
  DiscordIcon,
  SectionHeading,
  Strong,
  TextLink,
} from '@nx/nx-dev/ui-common';
import { YoutubeIcon } from '@nx/nx-dev/ui-icons';
import Link from 'next/link';

const yearsAgo = new Date().getFullYear() - 2017;

export function TeamAndCommunity(): JSX.Element {
  return (
    <section className="mx-auto max-w-7xl px-6 lg:px-8">
      <article className="max-w-5xl">
        <SectionHeading
          as="h2"
          variant="title"
          id="team-and-community"
          className="scroll-mt-24"
        >
          Backed by an awesome team and a thriving community.
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Founded {yearsAgo} years ago by two <Strong>ex-Googlers</Strong>, our
          mission is to revolutionize software development with the power of{' '}
          <TextLink
            href="https://github.com/nrwl/nx"
            title="Monorepo & OSS"
            target="_blank"
            rel="noopener"
          >
            monorepos and OSS
          </TextLink>
          . We are joined by a{' '}
          <TextLink
            href="/company?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_team_and_community"
            title="Our company"
          >
            talented and enthusiastic team
          </TextLink>
          , many of which are publicly recognized GDEs and MVPs.
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          We closely collaborate with many{' '}
          <TextLink href="/customers#popular-oss" title="OSS projects">
            OSS projects
          </TextLink>{' '}
          and companies in the ecosystem. Our team is highly motivated to{' '}
          <Strong>bring you the best learning material</Strong> through various
          channels.
        </SectionHeading>
      </article>

      <div className="mx-auto mt-24">
        <div className="grid grid-cols-2 gap-12 sm:grid-cols-3 sm:gap-8 lg:grid-cols-6 lg:gap-6">
          <div>
            <div className="group/item relative flex items-center gap-2 rounded-xl border border-slate-100 p-4 transition hover:text-slate-950 dark:border-slate-800/60 dark:hover:text-white">
              <DocumentIcon aria-hidden="true" className="size-6 shrink-0" />
              <Link
                href="/getting-started/intro?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_team_and_community"
                className="grow text-base"
                prefetch={false}
              >
                <span className="absolute inset-0" />
                Docs
              </Link>
              <ChevronRightIcon
                aria-hidden="true"
                className="size-4 shrink-0 transition group-hover/item:translate-x-1 "
              />
            </div>
          </div>
          <div>
            <div className="group/item relative flex items-center gap-2 rounded-xl border border-slate-100 p-4 transition hover:text-slate-950 dark:border-slate-800/60 dark:hover:text-white">
              <NewspaperIcon aria-hidden="true" className="size-6 shrink-0" />
              <Link
                href="/blog?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_team_and_community"
                className="grow text-base"
                prefetch={false}
              >
                <span className="absolute inset-0" />
                Blog
              </Link>
              <ChevronRightIcon
                aria-hidden="true"
                className="size-4 shrink-0 transition group-hover/item:translate-x-1 "
              />
            </div>
          </div>
          <div>
            <div className="group/item relative flex items-center gap-2 rounded-xl border border-slate-100 p-4 transition hover:text-slate-950 dark:border-slate-800/60 dark:hover:text-white">
              <YoutubeIcon aria-hidden="true" className="size-6 shrink-0" />
              <a
                href="https://youtube.com/@nxdevtools"
                className="grow text-base"
              >
                <span className="absolute inset-0" />
                Youtube
              </a>
              <ArrowUpRightIcon
                aria-hidden="true"
                className="size-4 shrink-0 transition group-hover/item:-translate-y-1 group-hover/item:translate-x-1"
              />
            </div>
          </div>

          <div>
            <div className="group/item relative flex items-center gap-2 rounded-xl border border-slate-100 p-4 transition hover:text-slate-950 dark:border-slate-800/60 dark:hover:text-white">
              <DiscordIcon aria-hidden="true" className="size-6 shrink-0" />
              <a
                href="https://go.nx.dev/community?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_team_and_community"
                className="grow text-base"
              >
                <span className="absolute inset-0" />
                Discord
              </a>
              <ArrowUpRightIcon
                aria-hidden="true"
                className="size-4 shrink-0 transition group-hover/item:-translate-y-1 group-hover/item:translate-x-1"
              />
            </div>
          </div>

          <div>
            <div className="group/item relative flex items-center gap-2 rounded-xl border border-slate-100 p-4 transition dark:border-slate-800/60 dark:hover:text-white">
              <MicrophoneIcon aria-hidden="true" className="size-6 shrink-0" />
              <Link
                href="https://podcasters.spotify.com/pod/show/enterprise-software"
                prefetch={false}
                rel="noreferrer"
                target="_blank"
                className="grow text-base"
              >
                <span className="absolute inset-0" />
                Podcasts
              </Link>
              <ArrowUpRightIcon
                aria-hidden="true"
                className="size-4 shrink-0 transition group-hover/item:-translate-y-1 group-hover/item:translate-x-1"
              />
            </div>
          </div>

          <div>
            <div className="group/item relative flex items-center gap-2 rounded-xl border border-slate-100 p-4 transition dark:border-slate-800/60 dark:hover:text-white">
              <ComputerDesktopIcon
                aria-hidden="true"
                className="size-6 shrink-0"
              />
              <Link
                href="https://go.nx.dev/june-webinar?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_team_and_community"
                prefetch={false}
                target="_blank"
                rel="noopener"
                className="grow text-base"
              >
                <span className="absolute inset-0" />
                Webinars
              </Link>
              <ArrowUpRightIcon
                aria-hidden="true"
                className="size-4 shrink-0 transition group-hover/item:-translate-y-1 group-hover/item:translate-x-1"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

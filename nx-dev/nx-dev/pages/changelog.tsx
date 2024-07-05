import { LinkIcon, TagIcon } from '@heroicons/react/24/outline';
import {
  Breadcrumbs,
  DocumentationHeader,
  Footer,
  SidebarContainer,
} from '@nx/nx-dev/ui-common';
import { renderMarkdown } from '@nx/nx-dev/ui-markdoc';
import { cx } from '@nx/nx-dev/ui-primitives';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { Octokit } from 'octokit';
import { compare, parse } from 'semver';
import { changeLogApi } from '../lib/changelog.api';
import { useNavToggle } from '../lib/navigation-toggle.effect';
import { menusApi } from '../lib/menus.api';
import { MenuItem } from '@nx/nx-dev/models-menu';
import { getBasicNxSection } from '@nx/nx-dev/data-access-menu';
import Link from 'next/link';

interface ChangelogEntry {
  version: string;
  date: string;
  content?: string;
  patches: string[];
  // used for markdown rendering in the component
  filePath?: string;
}

interface ChangeLogProps {
  changelog: ChangelogEntry[];
  menu: MenuItem[];
}

interface GithubReleaseData {
  published_at: string | null;
  tag_name: string;
  prerelease: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);

  const options: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  };

  const monthDayYear = date.toLocaleDateString('en-US', options);

  const day = date.getDate();
  const daySuffix = getDaySuffix(day);

  return monthDayYear.replace(day.toString(), day + daySuffix);

  // Function to get the day suffix (st, nd, rd, or th)
  function getDaySuffix(day) {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  }
}

async function fetchGithubRelease(
  octokit: Octokit,
  page: number = 1
): Promise<GithubReleaseData[]> {
  const responseData = await octokit.request(
    'GET /repos/{owner}/{repo}/releases',
    {
      owner: 'nrwl',
      repo: 'nx',
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
      page,
      per_page: 100,
    }
  );

  return responseData.data.map(({ published_at, tag_name, prerelease }) => ({
    published_at,
    tag_name,
    prerelease,
  }));
}

export async function getStaticProps(): Promise<{ props: ChangeLogProps }> {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  // do 2 fetches of 100 records, which should be enough releases to display
  const githubReleases = [
    ...(await fetchGithubRelease(octokit, 1)),
    ...(await fetchGithubRelease(octokit, 2)),
  ];

  const releasesByMinorVersion: {
    [tag_name: string]: ChangelogEntry;
  } = {};

  // group all releases by minor and add patch versions in the "patches" array of the corresponding minor version entry
  githubReleases
    .filter((data) => !data.prerelease)
    .forEach((release) => {
      const semverVersion = parse(release.tag_name);
      if (!semverVersion) {
        return;
      }

      if (semverVersion?.patch === 0) {
        // this is a minor or major
        releasesByMinorVersion[release.tag_name] = {
          version: release.tag_name,
          date: release.published_at
            ? formatDate(release.published_at)
            : '(unknown)',
          patches: releasesByMinorVersion[release.tag_name]?.patches || [],
        };
      } else {
        // find a corresponding minor version & add "release" to the patches array of it
        const minorVersion = `${semverVersion.major}.${semverVersion.minor}.0`;
        const minorRelease = releasesByMinorVersion[minorVersion];
        if (minorRelease) {
          minorRelease.patches = minorRelease.patches || [];
          minorRelease.patches.push(release.tag_name);
        } else {
          // create a new entry for the minor version
          releasesByMinorVersion[minorVersion] = {
            version: minorVersion,
            date: release.published_at
              ? formatDate(release.published_at)
              : '(unknown)',
            patches: [release.tag_name],
          };
        }
      }
    });

  const groupedReleases = Object.values(releasesByMinorVersion);

  // fetch potential manually written changelog content
  const changelogContent = changeLogApi.getChangelogEntries();

  for (const entry of groupedReleases) {
    const hasEntry = changelogContent.find((c) => c.version === entry.version);
    if (hasEntry) {
      entry.content = hasEntry.content;
      entry.filePath = hasEntry.filePath;
    }
  }

  // sort it by version desc
  groupedReleases.sort((a, b) => compare(b.version, a.version));

  return {
    props: {
      changelog: groupedReleases,
      menu: menusApi.getMenu('nx', ''),
    },
  };
}

export default function Changelog(props: ChangeLogProps): JSX.Element {
  const router = useRouter();

  const renderedChangelog = props.changelog.map((entry) => {
    if (entry.content) {
      const { node } = renderMarkdown(entry.content, {
        filePath: entry.filePath ?? '',
      });

      return {
        ...entry,
        version: entry.version,
        content: node,
        date: entry.date,
      };
    }

    return entry;
  });
  const convertToDate = (invalidDate) =>
    new Date(invalidDate.replace(/(nd|th|rd|st)/g, ''));
  const { toggleNav, navIsOpen } = useNavToggle();

  const menu = {
    sections: [getBasicNxSection(props.menu)],
  };

  return (
    <>
      <NextSeo
        title="Nx Changelog"
        description="Scroll and Enjoy the Nx Changelog"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx Changelog',
          description: 'Learn about all the changes',
          images: [
            {
              url: 'https://nx.dev/images/nx-media.jpg',
              width: 800,
              height: 421,
              alt: 'Nx: Smart Monorepos · Fast CI',
              type: 'image/jpeg',
            },
          ],
          siteName: 'NxDev',
          type: 'website',
        }}
      />
      <div className="w-full flex-shrink-0">
        <DocumentationHeader isNavOpen={navIsOpen} toggleNav={toggleNav} />
      </div>

      <main id="main" role="main">
        <div className="mx-auto flex max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Breadcrumbs path={router.asPath} />
          </div>
          <div className="hidden">
            <SidebarContainer
              menu={menu}
              toggleNav={toggleNav}
              navIsOpen={navIsOpen}
            />
          </div>
          <header className="mt-0">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl dark:text-slate-100">
              Nx Changelog
            </h1>
            <p className="mt-4">
              All the Nx goodies in one page, sorted by release. See our{' '}
              <Link
                className="underline"
                href="/reference/releases"
                prefetch={false}
              >
                release page
              </Link>{' '}
              for information about the release cycle and LTS policy.
            </p>
          </header>
          <ul className="m-0 space-y-6 py-6">
            {renderedChangelog.map((changelog, idx) => (
              <li key={changelog.version} className="relative gap-x-4 sm:flex">
                <div
                  className={cx(
                    idx === renderedChangelog.length - 1 ? 'h-6' : '-bottom-6',
                    'absolute left-0 top-0 hidden w-6 justify-center sm:flex'
                  )}
                >
                  <div className="w-px bg-slate-200 dark:bg-slate-700" />
                </div>
                <div className="relative mt-1 hidden h-6 w-6 flex-none items-center justify-center sm:flex">
                  <div className="h-2 w-2 rounded-full bg-slate-100 ring-1 ring-slate-300 dark:bg-slate-600 dark:ring-slate-500" />
                </div>
                <div
                  id={changelog.version}
                  className="group flex w-36 shrink-0 flex-col"
                >
                  <p className="py-0.5">
                    <a
                      title="See release tag on GitHub"
                      href={`https://github.com/nrwl/nx/releases/tag/${changelog.version}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xl font-medium leading-5 text-slate-900 hover:underline dark:text-slate-100"
                    >
                      <TagIcon
                        className="inline-flex h-4 w-4"
                        aria-hidden="true"
                      />{' '}
                      v{changelog.version.split('.').slice(0, 2).join('.')}
                    </a>
                    <Link aria-hidden="true" href={`#${changelog.version}`}>
                      <LinkIcon className="mb-1 ml-2 inline h-5 w-5 opacity-0 group-hover:opacity-100" />
                    </Link>
                  </p>
                  <p className="py-0.5 text-xs leading-5 text-slate-400 dark:text-slate-500">
                    <time
                      dateTime={convertToDate(
                        changelog.date
                      ).toLocaleDateString()}
                    >
                      {changelog.date}
                    </time>
                  </p>
                </div>
                {/* CONTAINER */}
                <div className="flex flex-grow flex-col gap-8 md:ml-12">
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    {changelog.content}
                  </div>
                  {changelog.patches.length > 0 && (
                    <div className="space-x-2 text-right">
                      {changelog.patches.map((version) => (
                        <a
                          key={version}
                          href={`https://github.com/nrwl/nx/releases/tag/${version}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10 hover:underline dark:bg-slate-600/30 dark:text-slate-500 dark:ring-slate-700"
                        >
                          {version}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <Footer />
    </>
  );
}

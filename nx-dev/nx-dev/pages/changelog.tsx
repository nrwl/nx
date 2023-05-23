import { Footer, Header } from '@nx/nx-dev/ui-common';
import { Octokit } from 'octokit';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { GithubRepository, renderMarkdown } from '@nx/nx-dev/ui-markdoc';
import { compare, parse } from 'semver';
import { changeLogApi } from '../lib/changelog.api';

interface ChangelogEntry {
  version: string;
  date: string | null;
  content?: string;
  patches: string[];
  // used for markdown rendering in the component
  filePath?: string;
}

interface ChangeLogProps {
  changelog: ChangelogEntry[];
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
    .filter((data) => data.prerelease === false)
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
        // find corresponding minor version & add "release" to the patches array of it
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
              alt: 'Nx: Smart, Fast and Extensible Build System',
              type: 'image/jpeg',
            },
          ],
          siteName: 'NxDev',
          type: 'website',
        }}
      />
      <Header />
      <main id="main" role="main">
        <div className="mx-auto flex max-w-7xl flex-col space-y-12 py-12 px-4 sm:px-6 lg:space-y-0 lg:space-x-20 lg:py-16 lg:px-8">
          <header className="space-y-10 md:py-12">
            <div className="">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
                Nx Changelog
              </h1>
              <p className="mt-4">
                All the Nx goodies in one page, sorted by release
              </p>
            </div>
          </header>
          <div>
            {renderedChangelog.map((changelog) => (
              <div
                key={changelog.version}
                className="grid border-l pb-24 lg:grid-cols-12 lg:gap-8"
              >
                <div className="col-span-12 mb-8 self-start lg:sticky lg:top-0 lg:col-span-4 lg:-mt-32 lg:pt-32 ">
                  <div className="flex w-full items-baseline gap-6">
                    <div className="bg-slate-800 dark:bg-scale-500 border-scale-400 dark:border-scale-600 text-scale-900 -ml-2.5 flex h-5 w-5 items-center justify-center rounded border drop-shadow-sm">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="sbui-icon "
                      >
                        <circle cx="12" cy="12" r="4"></circle>
                        <line x1="1.05" y1="12" x2="7" y2="12"></line>
                        <line x1="17.01" y1="12" x2="22.96" y2="12"></line>
                      </svg>
                    </div>
                    <div className="flex w-full flex-col gap-1">
                      <h3 className="text-2xl font-bold">
                        v{changelog.version}
                      </h3>
                      <p>{changelog.date}</p>
                    </div>
                  </div>
                </div>
                <div className="col-span-8 ml-8 lg:ml-0">
                  <article className="prose prose-slate dark:prose-invert max-w-none">
                    {changelog.content}

                    <GithubRepository
                      title="GitHub release"
                      url={`https://github.com/nrwl/nx/releases/tag/${changelog.version}`}
                    />

                    {changelog.patches?.length > 0 && (
                      <h2 className="text-white">Patches</h2>
                    )}
                    {changelog.patches?.length > 0 && (
                      <div className="space-y-4">
                        {changelog.patches?.map((version) => (
                          <a
                            href={`https://github.com/nrwl/nx/releases/tag/${version}`}
                            className="inline-flex items-center justify-center px-4 py-2 mr-2 space-x-2 font-medium text-white bg-gray-800 rounded-md hover:bg-gray-700"
                            key={version}
                          >
                            <svg
                              className="h-8 w-8 rounded-full object-cover"
                              viewBox="0 0 16 16"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                              ></path>
                            </svg>
                            <span>{version}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </article>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

import * as chalk from 'chalk';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirSync } from 'tmp';
import { joinPathFragments, logger, output } from '../../devkit-exports';
import { ChangelogOptions } from './command-object';
import { getGitDiff, getLastGitTag, parseCommits } from './utils/git';
import {
  GithubRelease,
  GithubRequestConfig,
  createOrUpdateGithubRelease,
  generateMarkdown,
  getGitHubRemote,
  getGithubReleaseByTag,
  resolveGithubToken,
} from './utils/github';
import { launchEditor } from './utils/launch-editor';
import { printDiff } from './utils/print-diff';
import { prerelease } from 'semver';

export async function changelogHandler(args: ChangelogOptions): Promise<void> {
  /**
   * TODO: allow the prefix and version to be controllable via config as well once we flesh out
   * changelog customization, and how it will interact with independently released projects.
   */
  const tagVersionPrefix = args.tagVersionPrefix ?? 'v';
  // Allow the user to pass the version with or without the prefix already applied
  const releaseVersion = args.version.startsWith(tagVersionPrefix)
    ? args.version
    : `${tagVersionPrefix}${args.version}`;

  const githubRemote = getGitHubRemote(args.gitRemote);
  const token = await resolveGithubToken();
  const githubRequestConfig: GithubRequestConfig = {
    repo: githubRemote,
    token,
  };

  const from = args.from || (await getLastGitTag());
  if (!from) {
    throw new Error(
      `Could not determine the previous git tag, please provide and explicit reference using --from`
    );
  }
  const to = args.to;
  const rawCommits = await getGitDiff(from, args.to);

  // Parse as conventional commits
  const commits = parseCommits(rawCommits).filter((c) => {
    const type = c.type;
    // Always ignore non user-facing commits for now
    // TODO: allow this filter to be configurable via config in a future release
    if (type === 'feat' || type === 'fix' || type === 'perf') {
      return true;
    }
    return false;
  });

  const initialMarkdown = await generateMarkdown(
    commits,
    releaseVersion,
    githubRequestConfig
  );

  let finalMarkdown = initialMarkdown;

  /**
   * If interactive mode, make the markdown available for the user to modify in their editor of choice,
   * in a similar style to git interactive rebases/merges.
   */
  if (args.interactive) {
    const tmpDir = dirSync().name;
    const changelogPath = joinPathFragments(tmpDir, 'c.md');
    writeFileSync(changelogPath, initialMarkdown);
    await launchEditor(changelogPath);
    finalMarkdown = readFileSync(changelogPath, 'utf-8');
  }

  let existingGithubReleaseForVersion: GithubRelease;
  try {
    existingGithubReleaseForVersion = await getGithubReleaseByTag(
      githubRequestConfig,
      releaseVersion
    );
  } catch (err) {
    if (err.response?.status === 401) {
      output.error({
        title: `Unable to resolve data via the Github API. You can use any of the following options to resolve this:`,
        bodyLines: [
          '- Set the `GITHUB_TOKEN` or `GH_TOKEN` environment variable to a valid Github token with `repo` scope',
          '- Have an active session via the official gh CLI tool (https://cli.github.com) in your current terminal',
        ],
      });
      process.exit(1);
    }
    if (err.response?.status === 404) {
      // No existing release found, this is fine
    } else {
      // Rethrow unknown errors for now
      throw err;
    }
  }

  const changesRangeText =
    to === 'HEAD' ? `since ${from}` : `between ${from} and ${to}`;

  if (existingGithubReleaseForVersion) {
    output.log({
      title: `Found existing Github release for ${chalk.white(
        releaseVersion
      )}, regenerating with changes ${chalk.cyan(changesRangeText)}`,
    });
  } else {
    output.log({
      title: `Creating a new Github release for ${chalk.white(
        releaseVersion
      )}, including changes ${chalk.cyan(changesRangeText)}`,
    });
  }

  printReleaseLog(
    releaseVersion,
    githubRemote,
    args.dryRun,
    finalMarkdown,
    existingGithubReleaseForVersion
  );

  if (args.dryRun) {
    logger.warn(`\nNOTE: The "dryRun" flag means no changes were made.`);
  } else {
    await createOrUpdateGithubRelease(
      githubRequestConfig,
      {
        version: releaseVersion,
        body: finalMarkdown,
        prerelease: isPrerelease(
          releaseVersion.replace(args.tagVersionPrefix, '')
        ),
      },
      existingGithubReleaseForVersion
    );
  }

  process.exit(0);
}

function printReleaseLog(
  releaseVersion: string,
  githubRemote: string,
  isDryRun: boolean,
  finalMarkdown: string,
  existingGithubReleaseForVersion?: GithubRelease
) {
  const logTitle = `https://github.com/${githubRemote}/releases/tag/${releaseVersion}`;
  if (existingGithubReleaseForVersion) {
    console.error(
      `${chalk.white('UPDATE')} ${logTitle}${
        isDryRun ? chalk.keyword('orange')(' [dry-run]') : ''
      }`
    );
  } else {
    console.error(
      `${chalk.green('CREATE')} ${logTitle}${
        isDryRun ? chalk.keyword('orange')(' [dry-run]') : ''
      }`
    );
  }
  console.log('');
  printDiff('', finalMarkdown);
}

function isPrerelease(version: string): boolean {
  // prerelease returns an array of matching prerelease "components", or null if the version is not a prerelease
  return prerelease(version) !== null;
}

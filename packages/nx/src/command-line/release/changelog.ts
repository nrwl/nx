import * as chalk from 'chalk';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirSync } from 'tmp';
import { FsTree } from '../../generators/tree';
import { logger } from '../../utils/logger';
import { output } from '../../utils/output';
import { joinPathFragments } from '../../utils/path';
import { workspaceRoot } from '../../utils/workspace-root';
import { ChangelogOptions } from './command-object';
import {
  GitCommit,
  getGitDiff,
  getLastGitTag,
  parseCommits,
} from './utils/git';
import {
  GithubRelease,
  GithubRequestConfig,
  RepoSlug,
  createOrUpdateGithubRelease,
  getGitHubRepoSlug,
  getGithubReleaseByTag,
  resolveGithubToken,
} from './utils/github';
import { launchEditor } from './utils/launch-editor';
import { generateMarkdown, parseChangelogMarkdown } from './utils/markdown';
import { printChanges, printDiff } from './utils/print-changes';

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

  // We are either creating/previewing a changelog file, a Github release, or both
  let logTitle = args.dryRun ? 'Previewing a ' : 'Generating a ';
  switch (true) {
    case args.file !== false && args.createRelease === 'github':
      logTitle += `${args.file} entry and a Github release for ${chalk.white(
        releaseVersion
      )}`;
      break;
    case args.file !== false:
      logTitle += `${args.file} entry for ${chalk.white(releaseVersion)}`;
      break;
    case args.createRelease === 'github':
      logTitle += `Github release for ${chalk.white(releaseVersion)}`;
  }

  output.log({
    title: logTitle,
  });

  const from = args.from || (await getLastGitTag());
  if (!from) {
    output.error({
      title: `Unable to determine the previous git tag, please provide an explicit git reference using --from`,
    });
    process.exit(1);
  }
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

  const githubRepoSlug =
    args.createRelease === 'github'
      ? getGitHubRepoSlug(args.gitRemote)
      : undefined;

  const finalMarkdown = await resolveFinalMarkdown(
    args,
    commits,
    releaseVersion,
    githubRepoSlug
  );

  /**
   * The exact logic we use for printing the summary/diff to the user is dependent upon whether they are creating
   * a CHANGELOG.md file, a Github release, or both.
   */
  let printSummary = () => {};
  const noDiffInChangelogMessage = chalk.yellow(
    `NOTE: There was no diff detected for the changelog entry. Maybe you intended to pass alternative git references via --from and --to?`
  );

  if (args.file !== false) {
    const tree = new FsTree(workspaceRoot, args.verbose);

    let rootChangelogContents = tree.read(args.file)?.toString() ?? '';
    if (rootChangelogContents) {
      const changelogReleases = parseChangelogMarkdown(
        rootChangelogContents,
        args.tagVersionPrefix
      ).releases;

      const existingVersionToUpdate = changelogReleases.find(
        (r) => `${tagVersionPrefix}${r.version}` === releaseVersion
      );
      if (existingVersionToUpdate) {
        rootChangelogContents = rootChangelogContents.replace(
          `## ${releaseVersion}\n\n\n${existingVersionToUpdate.body}`,
          finalMarkdown
        );
      } else {
        // No existing version, simply prepend the new release to the top of the file
        rootChangelogContents = `${finalMarkdown}\n\n${rootChangelogContents}`;
      }
    } else {
      // No existing changelog contents, simply create a new one using the generated markdown
      rootChangelogContents = finalMarkdown;
    }

    tree.write(args.file, rootChangelogContents);

    printSummary = () =>
      printChanges(tree, !!args.dryRun, 3, false, noDiffInChangelogMessage);
  }

  if (args.createRelease === 'github') {
    if (!githubRepoSlug) {
      output.error({
        title: `Unable to create a Github release because the Github repo slug could not be determined.`,
        bodyLines: [
          `Please ensure you have a valid Github remote configured. You can run \`git remote -v\` to list your current remotes.`,
        ],
      });
      process.exit(1);
    }

    const token = await resolveGithubToken();
    const githubRequestConfig: GithubRequestConfig = {
      repo: githubRepoSlug,
      token,
    };

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

    let existingPrintSummaryFn = printSummary;
    printSummary = () => {
      const logTitle = `https://github.com/${githubRepoSlug}/releases/tag/${releaseVersion}`;
      if (existingGithubReleaseForVersion) {
        console.error(
          `${chalk.white('UPDATE')} ${logTitle}${
            args.dryRun ? chalk.keyword('orange')(' [dry-run]') : ''
          }`
        );
      } else {
        console.error(
          `${chalk.green('CREATE')} ${logTitle}${
            args.dryRun ? chalk.keyword('orange')(' [dry-run]') : ''
          }`
        );
      }
      // Only print the diff here if we are not already going to be printing changes from the Tree
      if (args.file === false) {
        console.log('');
        printDiff(
          existingGithubReleaseForVersion
            ? existingGithubReleaseForVersion.body
            : '',
          finalMarkdown,
          3,
          noDiffInChangelogMessage
        );
      }
      existingPrintSummaryFn();
    };

    if (!args.dryRun) {
      await createOrUpdateGithubRelease(
        githubRequestConfig,
        {
          version: releaseVersion,
          body: finalMarkdown,
        },
        existingGithubReleaseForVersion
      );
    }
  }

  printSummary();

  if (args.dryRun) {
    logger.warn(`\nNOTE: The "dryRun" flag means no changes were made.`);
  }

  process.exit(0);
}

/**
 * Based on the commits available, and some optional additional user modifications,
 * generate the final markdown for the changelog which will be used for a CHANGELOG.md
 * file and/or a Github release.
 */
async function resolveFinalMarkdown(
  args: ChangelogOptions,
  commits: GitCommit[],
  releaseVersion: string,
  githubRepoSlug?: RepoSlug
): Promise<string> {
  let markdown = await generateMarkdown(
    commits,
    releaseVersion,
    githubRepoSlug
  );
  /**
   * If interactive mode, make the markdown available for the user to modify in their editor of choice,
   * in a similar style to git interactive rebases/merges.
   */
  if (args.interactive) {
    const tmpDir = dirSync().name;
    const changelogPath = joinPathFragments(tmpDir, 'c.md');
    writeFileSync(changelogPath, markdown);
    await launchEditor(changelogPath);
    markdown = readFileSync(changelogPath, 'utf-8');
  }
  return markdown;
}

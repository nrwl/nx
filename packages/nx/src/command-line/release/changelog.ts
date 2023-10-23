import * as chalk from 'chalk';
import { readFileSync, writeFileSync } from 'node:fs';
import { prerelease, valid } from 'semver';
import { dirSync } from 'tmp';
import type { ChangelogRenderer } from '../../../changelog-renderer';
import { readNxJson } from '../../config/nx-json';
import { ProjectGraphProjectNode } from '../../config/project-graph';
import { FsTree, Tree } from '../../generators/tree';
import { registerTsProject } from '../../plugins/js/utils/register';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { interpolate } from '../../tasks-runner/utils';
import { logger } from '../../utils/logger';
import { output } from '../../utils/output';
import { joinPathFragments } from '../../utils/path';
import { getRootTsConfigPath } from '../../utils/typescript';
import { workspaceRoot } from '../../utils/workspace-root';
import { ChangelogOptions } from './command-object';
import {
  NxReleaseConfig,
  createNxReleaseConfig,
  handleNxReleaseConfigError,
} from './config/config';
import { filterReleaseGroups } from './config/filter-release-groups';
import {
  GitCommit,
  getGitDiff,
  getLatestGitTagForPattern,
  parseCommits,
} from './utils/git';
import {
  GithubRelease,
  GithubRequestConfig,
  createOrUpdateGithubRelease,
  getGitHubRepoSlug,
  getGithubReleaseByTag,
  resolveGithubToken,
} from './utils/github';
import { launchEditor } from './utils/launch-editor';
import { parseChangelogMarkdown } from './utils/markdown';
import { printChanges, printDiff } from './utils/print-changes';

class ReleaseVersion {
  rawVersion: string;
  gitTag: string;
  isPrerelease: boolean;

  constructor({
    version, // short form version string with no prefixes or patterns, e.g. 1.0.0
    releaseTagPattern, // full pattern to interpolate, e.g. "v{version}" or "{projectName}@{version}"
    projectName, // optional project name to interpolate into the releaseTagPattern
  }: {
    version: string;
    releaseTagPattern: string;
    projectName?: string;
  }) {
    this.rawVersion = version;
    this.gitTag = interpolate(releaseTagPattern, {
      version,
      projectName,
    });
    this.isPrerelease = isPrerelease(version);
  }
}

export async function changelogHandler(args: ChangelogOptions): Promise<void> {
  // Right now, the given version must be valid semver in order to proceed
  if (!valid(args.version)) {
    output.error({
      title: `The given version "${args.version}" is not a valid semver version. Please provide your version in the format "1.0.0", "1.0.0-beta.1" etc`,
    });
    process.exit(1);
  }

  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  const nxJson = readNxJson();

  if (args.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }

  // Apply default configuration to any optional user configuration
  const { error: configError, nxReleaseConfig } = await createNxReleaseConfig(
    projectGraph,
    nxJson.release
  );
  if (configError) {
    return await handleNxReleaseConfigError(configError);
  }

  const {
    error: filterError,
    releaseGroups,
    releaseGroupToFilteredProjects,
  } = filterReleaseGroups(
    projectGraph,
    nxReleaseConfig,
    args.projects,
    args.groups
  );
  if (filterError) {
    output.error(filterError);
    process.exit(1);
  }

  const releaseVersion = new ReleaseVersion({
    version: args.version,
    releaseTagPattern: nxReleaseConfig.releaseTagPattern,
  });

  const from =
    args.from ||
    (await getLatestGitTagForPattern(nxReleaseConfig.releaseTagPattern))?.tag;
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

  const tree = new FsTree(workspaceRoot, args.verbose);

  await generateChangelogForWorkspace(
    tree,
    releaseVersion,
    !!args.dryRun,
    // Only trigger interactive mode for the workspace changelog if the user explicitly requested it via "all" or "workspace"
    args.interactive === 'all' || args.interactive === 'workspace',
    commits,
    nxReleaseConfig.changelog.workspaceChangelog,
    args.gitRemote
  );

  if (args.projects?.length) {
    /**
     * Run changelog generation for all remaining release groups and filtered projects within them
     */
    for (const releaseGroup of releaseGroups) {
      const projectNodes = Array.from(
        releaseGroupToFilteredProjects.get(releaseGroup)
      ).map((name) => projectGraph.nodes[name]);

      await generateChangelogForProjects(
        tree,
        args.version,
        !!args.dryRun,
        // Only trigger interactive mode for the workspace changelog if the user explicitly requested it via "all" or "projects"
        args.interactive === 'all' || args.interactive === 'projects',
        commits,
        releaseGroup.changelog,
        releaseGroup.releaseTagPattern,
        projectNodes,
        args.gitRemote
      );
    }

    return process.exit(0);
  }

  /**
   * Run changelog generation for all remaining release groups
   */
  for (const releaseGroup of releaseGroups) {
    const projectNodes = releaseGroup.projects.map(
      (name) => projectGraph.nodes[name]
    );

    await generateChangelogForProjects(
      tree,
      args.version,
      !!args.dryRun,
      // Only trigger interactive mode for the workspace changelog if the user explicitly requested it via "all" or "projects"
      args.interactive === 'all' || args.interactive === 'projects',
      commits,
      releaseGroup.changelog,
      releaseGroup.releaseTagPattern,
      projectNodes,
      args.gitRemote
    );
  }

  if (args.dryRun) {
    logger.warn(
      `\nNOTE: The "dryRun" flag means no changelogs were actually created.`
    );
  }

  process.exit(0);
}

function isPrerelease(version: string): boolean {
  // prerelease returns an array of matching prerelease "components", or null if the version is not a prerelease
  return prerelease(version) !== null;
}

function resolveChangelogRenderer(
  changelogRendererPath: string
): ChangelogRenderer {
  // Try and load the provided (or default) changelog renderer
  let changelogRenderer: ChangelogRenderer;
  let cleanupTranspiler = () => {};
  try {
    const rootTsconfigPath = getRootTsConfigPath();
    if (rootTsconfigPath) {
      cleanupTranspiler = registerTsProject(rootTsconfigPath);
    }
    const r = require(changelogRendererPath);
    changelogRenderer = r.default || r;
  } catch {
  } finally {
    cleanupTranspiler();
  }
  return changelogRenderer;
}

async function generateChangelogForWorkspace(
  tree: Tree,
  releaseVersion: ReleaseVersion,
  dryRun: boolean,
  interactive: boolean,
  commits: GitCommit[],
  config: NxReleaseConfig['changelog']['workspaceChangelog'],
  gitRemote?: string
) {
  // The entire feature is disabled at the workspace level, exit early
  if (config === false) {
    return;
  }

  const changelogRenderer = resolveChangelogRenderer(config.renderer);

  let interpolatedTreePath = config.file || '';
  if (interpolatedTreePath) {
    interpolatedTreePath = interpolate(interpolatedTreePath, {
      projectName: '', // n/a for the workspace changelog
      projectRoot: '', // n/a for the workspace changelog
      workspaceRoot: '', // within the tree, workspaceRoot is the root
    });
  }

  // We are either creating/previewing a changelog file, a Github release, or both
  let logTitle = dryRun ? 'Previewing a' : 'Generating a';
  switch (true) {
    case interpolatedTreePath && config.createRelease === 'github':
      logTitle += ` Github release and an entry in ${interpolatedTreePath} for ${chalk.white(
        releaseVersion.gitTag
      )}`;
      break;
    case !!interpolatedTreePath:
      logTitle += `n entry in ${interpolatedTreePath} for ${chalk.white(
        releaseVersion.gitTag
      )}`;
      break;
    case config.createRelease === 'github':
      logTitle += ` Github release for ${chalk.white(releaseVersion.gitTag)}`;
  }

  output.log({
    title: logTitle,
  });

  const githubRepoSlug =
    config.createRelease === 'github'
      ? getGitHubRepoSlug(gitRemote)
      : undefined;

  let contents = await changelogRenderer({
    commits,
    releaseVersion: releaseVersion.rawVersion,
    project: null,
    repoSlug: githubRepoSlug,
    entryWhenNoChanges: config.entryWhenNoChanges,
    changelogRenderOptions: config.renderOptions,
  });

  /**
   * If interactive mode, make the changelog contents available for the user to modify in their editor of choice,
   * in a similar style to git interactive rebases/merges.
   */
  if (interactive) {
    const tmpDir = dirSync().name;
    const changelogPath = joinPathFragments(
      tmpDir,
      // Include the tree path in the name so that it is easier to identify which changelog file is being edited
      `PREVIEW__${interpolatedTreePath.replace(/\//g, '_')}`
    );
    writeFileSync(changelogPath, contents);
    await launchEditor(changelogPath);
    contents = readFileSync(changelogPath, 'utf-8');
  }

  /**
   * The exact logic we use for printing the summary/diff to the user is dependent upon whether they are creating
   * a changelog file, a Github release, or both.
   */
  let printSummary = () => {};
  const noDiffInChangelogMessage = chalk.yellow(
    `NOTE: There was no diff detected for the changelog entry. Maybe you intended to pass alternative git references via --from and --to?`
  );

  if (interpolatedTreePath) {
    let rootChangelogContents =
      tree.read(interpolatedTreePath)?.toString() ?? '';
    if (rootChangelogContents) {
      // NOTE: right now existing releases are always expected to be in markdown format, but in the future we could potentially support others via a custom parser option
      const changelogReleases = parseChangelogMarkdown(
        rootChangelogContents
      ).releases;

      const existingVersionToUpdate = changelogReleases.find(
        (r) => r.version === releaseVersion.rawVersion
      );
      if (existingVersionToUpdate) {
        rootChangelogContents = rootChangelogContents.replace(
          `## ${releaseVersion.rawVersion}\n\n\n${existingVersionToUpdate.body}`,
          contents
        );
      } else {
        // No existing version, simply prepend the new release to the top of the file
        rootChangelogContents = `${contents}\n\n${rootChangelogContents}`;
      }
    } else {
      // No existing changelog contents, simply create a new one using the generated contents
      rootChangelogContents = contents;
    }

    tree.write(interpolatedTreePath, rootChangelogContents);

    printSummary = () =>
      printChanges(tree, !!dryRun, 3, false, noDiffInChangelogMessage);
  }

  if (config.createRelease === 'github') {
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
        releaseVersion.gitTag
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
      const logTitle = `https://github.com/${githubRepoSlug}/releases/tag/${releaseVersion.gitTag}`;
      if (existingGithubReleaseForVersion) {
        console.error(
          `${chalk.white('UPDATE')} ${logTitle}${
            dryRun ? chalk.keyword('orange')(' [dry-run]') : ''
          }`
        );
      } else {
        console.error(
          `${chalk.green('CREATE')} ${logTitle}${
            dryRun ? chalk.keyword('orange')(' [dry-run]') : ''
          }`
        );
      }
      // Only print the diff here if we are not already going to be printing changes from the Tree
      if (!interpolatedTreePath) {
        console.log('');
        printDiff(
          existingGithubReleaseForVersion
            ? existingGithubReleaseForVersion.body
            : '',
          contents,
          3,
          noDiffInChangelogMessage
        );
      }
      existingPrintSummaryFn();
    };

    if (!dryRun) {
      await createOrUpdateGithubRelease(
        githubRequestConfig,
        {
          version: releaseVersion.gitTag,
          prerelease: releaseVersion.isPrerelease,
          body: contents,
        },
        existingGithubReleaseForVersion
      );
    }
  }

  printSummary();
}

async function generateChangelogForProjects(
  tree: Tree,
  rawVersion: string,
  dryRun: boolean,
  interactive: boolean,
  commits: GitCommit[],
  config: NxReleaseConfig['changelog']['projectChangelogs'],
  releaseTagPattern: string,
  projects: ProjectGraphProjectNode[],
  gitRemote?: string
) {
  // The entire feature is disabled at the project level, exit early
  if (config === false) {
    return;
  }

  const changelogRenderer = resolveChangelogRenderer(config.renderer);

  for (const project of projects) {
    let interpolatedTreePath = config.file || '';
    if (interpolatedTreePath) {
      interpolatedTreePath = interpolate(interpolatedTreePath, {
        projectName: project.name,
        projectRoot: project.data.root,
        workspaceRoot: '', // within the tree, workspaceRoot is the root
      });
    }

    const releaseVersion = new ReleaseVersion({
      version: rawVersion,
      releaseTagPattern,
      projectName: project.name,
    });

    // We are either creating/previewing a changelog file, a Github release, or both
    let logTitle = dryRun ? 'Previewing a' : 'Generating a';
    switch (true) {
      case interpolatedTreePath && config.createRelease === 'github':
        logTitle += ` Github release and an entry in ${interpolatedTreePath} for ${chalk.white(
          releaseVersion.gitTag
        )}`;
        break;
      case !!interpolatedTreePath:
        logTitle += `n entry in ${interpolatedTreePath} for ${chalk.white(
          releaseVersion.gitTag
        )}`;
        break;
      case config.createRelease === 'github':
        logTitle += ` Github release for ${chalk.white(releaseVersion.gitTag)}`;
    }

    output.log({
      title: logTitle,
    });

    const githubRepoSlug =
      config.createRelease === 'github'
        ? getGitHubRepoSlug(gitRemote)
        : undefined;

    let contents = await changelogRenderer({
      commits,
      releaseVersion: releaseVersion.rawVersion,
      project: null,
      repoSlug: githubRepoSlug,
      entryWhenNoChanges:
        typeof config.entryWhenNoChanges === 'string'
          ? interpolate(config.entryWhenNoChanges, {
              projectName: project.name,
              projectRoot: project.data.root,
              workspaceRoot: '', // within the tree, workspaceRoot is the root
            })
          : false,
      changelogRenderOptions: config.renderOptions,
    });

    /**
     * If interactive mode, make the changelog contents available for the user to modify in their editor of choice,
     * in a similar style to git interactive rebases/merges.
     */
    if (interactive) {
      const tmpDir = dirSync().name;
      const changelogPath = joinPathFragments(
        tmpDir,
        // Include the tree path in the name so that it is easier to identify which changelog file is being edited
        `PREVIEW__${interpolatedTreePath.replace(/\//g, '_')}`
      );
      writeFileSync(changelogPath, contents);
      await launchEditor(changelogPath);
      contents = readFileSync(changelogPath, 'utf-8');
    }

    /**
     * The exact logic we use for printing the summary/diff to the user is dependent upon whether they are creating
     * a changelog file, a Github release, or both.
     */
    let printSummary = () => {};
    const noDiffInChangelogMessage = chalk.yellow(
      `NOTE: There was no diff detected for the changelog entry. Maybe you intended to pass alternative git references via --from and --to?`
    );

    if (interpolatedTreePath) {
      let changelogContents = tree.read(interpolatedTreePath)?.toString() ?? '';
      if (changelogContents) {
        // NOTE: right now existing releases are always expected to be in markdown format, but in the future we could potentially support others via a custom parser option
        const changelogReleases =
          parseChangelogMarkdown(changelogContents).releases;

        const existingVersionToUpdate = changelogReleases.find(
          (r) => r.version === releaseVersion.rawVersion
        );
        if (existingVersionToUpdate) {
          changelogContents = changelogContents.replace(
            `## ${releaseVersion.rawVersion}\n\n\n${existingVersionToUpdate.body}`,
            contents
          );
        } else {
          // No existing version, simply prepend the new release to the top of the file
          changelogContents = `${contents}\n\n${changelogContents}`;
        }
      } else {
        // No existing changelog contents, simply create a new one using the generated contents
        changelogContents = contents;
      }

      tree.write(interpolatedTreePath, changelogContents);

      printSummary = () =>
        printChanges(
          tree,
          !!dryRun,
          3,
          false,
          noDiffInChangelogMessage,
          // Only print the change for the current changelog file at this point
          (f) => f.path === interpolatedTreePath
        );
    }

    if (config.createRelease === 'github') {
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
          releaseVersion.gitTag
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
        const logTitle = `https://github.com/${githubRepoSlug}/releases/tag/${releaseVersion.gitTag}`;
        if (existingGithubReleaseForVersion) {
          console.error(
            `${chalk.white('UPDATE')} ${logTitle}${
              dryRun ? chalk.keyword('orange')(' [dry-run]') : ''
            }`
          );
        } else {
          console.error(
            `${chalk.green('CREATE')} ${logTitle}${
              dryRun ? chalk.keyword('orange')(' [dry-run]') : ''
            }`
          );
        }
        // Only print the diff here if we are not already going to be printing changes from the Tree
        if (!interpolatedTreePath) {
          console.log('');
          printDiff(
            existingGithubReleaseForVersion
              ? existingGithubReleaseForVersion.body
              : '',
            contents,
            3,
            noDiffInChangelogMessage
          );
        }
        existingPrintSummaryFn();
      };

      if (!dryRun) {
        await createOrUpdateGithubRelease(
          githubRequestConfig,
          {
            version: releaseVersion.gitTag,
            prerelease: releaseVersion.isPrerelease,
            body: contents,
          },
          existingGithubReleaseForVersion
        );
      }
    }

    printSummary();
  }
}

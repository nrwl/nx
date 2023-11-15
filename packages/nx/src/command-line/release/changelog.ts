import * as chalk from 'chalk';
import { readFileSync, writeFileSync } from 'node:fs';
import { valid } from 'semver';
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
import { handleErrors } from '../../utils/params';
import { joinPathFragments } from '../../utils/path';
import { getRootTsConfigPath } from '../../utils/typescript';
import { workspaceRoot } from '../../utils/workspace-root';
import { ChangelogOptions } from './command-object';
import {
  NxReleaseConfig,
  createNxReleaseConfig,
  handleNxReleaseConfigError,
} from './config/config';
import {
  ReleaseGroupWithName,
  filterReleaseGroups,
} from './config/filter-release-groups';
import {
  GitCommit,
  getCommitHash,
  getGitDiff,
  getLatestGitTagForPattern,
  gitPush,
  gitTag,
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
import { printAndFlushChanges, printDiff } from './utils/print-changes';
import {
  ReleaseVersion,
  VersionData,
  commitChanges,
  createCommitMessageValues,
  createGitTagValues,
  handleDuplicateGitTags,
} from './utils/shared';

type PostGitTask = (latestCommit: string) => Promise<void>;

export async function changelogHandler(
  args: ChangelogOptions
): Promise<number> {
  return handleErrors(args.verbose, async () => {
    // Right now, the given version must be valid semver in order to proceed
    if (!valid(args.version)) {
      throw new Error(
        `The given version "${args.version}" is not a valid semver version. Please provide your version in the format "1.0.0", "1.0.0-beta.1" etc`
      );
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

    const toSHA = await getCommitHash(args.to);
    const headSHA = args.to === 'HEAD' ? toSHA : await getCommitHash('HEAD');

    /**
     * Protect the user against attempting to create a new commit when recreating an old release changelog,
     * this seems like it would always be unintentional.
     */
    const autoCommitEnabled =
      args.gitCommit ?? nxReleaseConfig.changelog.git.commit;
    if (autoCommitEnabled && headSHA !== toSHA) {
      throw new Error(
        `You are attempting to recreate the changelog for an old release, but you have enabled auto-commit mode. Please disable auto-commit mode by updating your nx.json, or passing --git-commit=false`
      );
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

    const fromRef =
      args.from ||
      (await getLatestGitTagForPattern(nxReleaseConfig.releaseTagPattern))?.tag;
    if (!fromRef) {
      throw new Error(
        `Unable to determine the previous git tag, please provide an explicit git reference using --from`
      );
    }

    // Make sure that the fromRef is actually resolvable
    const fromSHA = await getCommitHash(fromRef);

    const rawCommits = await getGitDiff(fromSHA, toSHA);

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

    // Create a pseudo-versionData object using the version passed into the command so that we can share commit and tagging utils with version
    const versionData: VersionData = releaseGroups.reduce(
      (versionData, releaseGroup) => {
        const releaseGroupProjectNames = Array.from(
          releaseGroupToFilteredProjects.get(releaseGroup)
        );
        for (const projectName of releaseGroupProjectNames) {
          versionData[projectName] = {
            newVersion: args.version,
            currentVersion: '', // not needed within changelog/commit generation
            dependentProjects: [], // not needed within changelog/commit generation
          };
        }
        return versionData;
      },
      {}
    );

    const userCommitMessage: string | undefined =
      args.gitCommitMessage || nxReleaseConfig.changelog.git.commitMessage;

    const commitMessageValues: string[] = createCommitMessageValues(
      releaseGroups,
      releaseGroupToFilteredProjects,
      versionData,
      userCommitMessage
    );

    // Resolve any git tags as early as possible so that we can hard error in case of any duplicates before reaching the actual git command
    const gitTagValues: string[] =
      args.gitTag ?? nxReleaseConfig.changelog.git.tag
        ? createGitTagValues(
            releaseGroups,
            releaseGroupToFilteredProjects,
            versionData
          )
        : [];
    handleDuplicateGitTags(gitTagValues);

    const postGitTasks: PostGitTask[] = [];

    await generateChangelogForWorkspace(
      tree,
      args,
      nxReleaseConfig,
      commits,
      postGitTasks
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
          args,
          commits,
          postGitTasks,
          releaseGroup,
          projectNodes
        );
      }

      return await applyChangesAndExit(
        args,
        nxReleaseConfig,
        tree,
        toSHA,
        postGitTasks,
        commitMessageValues,
        gitTagValues
      );
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
        args,
        commits,
        postGitTasks,
        releaseGroup,
        projectNodes
      );
    }

    return await applyChangesAndExit(
      args,
      nxReleaseConfig,
      tree,
      toSHA,
      postGitTasks,
      commitMessageValues,
      gitTagValues
    );
  });
}

async function applyChangesAndExit(
  args: ChangelogOptions,
  nxReleaseConfig: NxReleaseConfig,
  tree: Tree,
  toSHA: string,
  postGitTasks: PostGitTask[],
  commitMessageValues: string[],
  gitTagValues: string[]
) {
  let latestCommit = toSHA;

  // Generate a new commit for the changes, if configured to do so
  if (args.gitCommit ?? nxReleaseConfig.changelog.git.commit) {
    await commitChanges(
      tree.listChanges().map((f) => f.path),
      !!args.dryRun,
      !!args.verbose,
      commitMessageValues,
      args.gitCommitArgs || nxReleaseConfig.changelog.git.commitArgs
    );
    // Resolve the commit we just made
    latestCommit = await getCommitHash('HEAD');
  }

  // Generate a one or more git tags for the changes, if configured to do so
  if (args.gitTag ?? nxReleaseConfig.changelog.git.tag) {
    output.logSingleLine(`Tagging commit with git`);
    for (const tag of gitTagValues) {
      await gitTag({
        tag,
        message: args.gitTagMessage || nxReleaseConfig.changelog.git.tagMessage,
        additionalArgs:
          args.gitTagArgs || nxReleaseConfig.changelog.git.tagArgs,
        dryRun: args.dryRun,
        verbose: args.verbose,
      });
    }
  }

  // Run any post-git tasks in series
  for (const postGitTask of postGitTasks) {
    await postGitTask(latestCommit);
  }

  if (args.dryRun) {
    logger.warn(
      `\nNOTE: The "dryRun" flag means no changelogs were actually created.`
    );
  }

  return 0;
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
  args: ChangelogOptions,
  nxReleaseConfig: NxReleaseConfig,
  commits: GitCommit[],
  postGitTasks: PostGitTask[]
) {
  const config = nxReleaseConfig.changelog.workspaceChangelog;
  // The entire feature is disabled at the workspace level, exit early
  if (config === false) {
    return;
  }

  // Only trigger interactive mode for the workspace changelog if the user explicitly requested it via "all" or "workspace"
  const interactive =
    args.interactive === 'all' || args.interactive === 'workspace';
  const dryRun = !!args.dryRun;
  const verbose = !!args.verbose;
  const gitRemote = args.gitRemote;

  const changelogRenderer = resolveChangelogRenderer(config.renderer);

  let interpolatedTreePath = config.file || '';
  if (interpolatedTreePath) {
    interpolatedTreePath = interpolate(interpolatedTreePath, {
      projectName: '', // n/a for the workspace changelog
      projectRoot: '', // n/a for the workspace changelog
      workspaceRoot: '', // within the tree, workspaceRoot is the root
    });
  }

  const releaseVersion = new ReleaseVersion({
    version: args.version,
    releaseTagPattern: nxReleaseConfig.releaseTagPattern,
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
    let rootChangelogContents = tree.exists(interpolatedTreePath)
      ? tree.read(interpolatedTreePath).toString()
      : '';
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
      printAndFlushChanges(tree, !!dryRun, 3, false, noDiffInChangelogMessage);
  }

  // Schedule tagging of the repo with the release version for the whole workspace, if applicable
  if (args.gitTag ?? nxReleaseConfig.changelog.git.tag) {
    postGitTasks.push(async () => {
      output.logSingleLine(`Tagging commit with git`);
      await gitTag({
        tag: releaseVersion.gitTag,
        message: args.gitTagMessage || nxReleaseConfig.changelog.git.tagMessage,
        additionalArgs:
          args.gitTagArgs || nxReleaseConfig.changelog.git.tagArgs,
        dryRun,
        verbose,
      });
    });
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

    // Only schedule the actual GitHub update when not in dry-run mode
    if (!dryRun) {
      postGitTasks.push(async (latestCommit) => {
        // Before we can create/update the release we need to ensure the commit exists on the remote
        await gitPush();

        await createOrUpdateGithubRelease(
          githubRequestConfig,
          {
            version: releaseVersion.gitTag,
            prerelease: releaseVersion.isPrerelease,
            body: contents,
            commit: latestCommit,
          },
          existingGithubReleaseForVersion
        );
      });
    }
  }

  printSummary();
}

async function generateChangelogForProjects(
  tree: Tree,
  args: ChangelogOptions,
  commits: GitCommit[],
  postGitTasks: PostGitTask[],
  releaseGroup: ReleaseGroupWithName,
  projects: ProjectGraphProjectNode[]
) {
  const config = releaseGroup.changelog;
  // The entire feature is disabled at the release group level, exit early
  if (config === false) {
    return;
  }

  // Only trigger interactive mode for the project changelog if the user explicitly requested it via "all" or "projects"
  const interactive =
    args.interactive === 'all' || args.interactive === 'projects';
  const dryRun = !!args.dryRun;
  const gitRemote = args.gitRemote;
  const rawVersion = args.version;

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
      releaseTagPattern: releaseGroup.releaseTagPattern,
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
      project: project.name,
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
      let changelogContents = tree.exists(interpolatedTreePath)
        ? tree.read(interpolatedTreePath).toString()
        : '';
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
        printAndFlushChanges(
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

      // Only schedule the actual GitHub update when not in dry-run mode
      if (!dryRun) {
        postGitTasks.push(async (latestCommit) => {
          // Before we can create/update the release we need to ensure the commit exists on the remote
          await gitPush();

          await createOrUpdateGithubRelease(
            githubRequestConfig,
            {
              version: releaseVersion.gitTag,
              prerelease: releaseVersion.isPrerelease,
              body: contents,
              commit: latestCommit,
            },
            existingGithubReleaseForVersion
          );
        });
      }
    }

    printSummary();
  }
}

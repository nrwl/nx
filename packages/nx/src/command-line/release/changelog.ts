import * as chalk from 'chalk';
import { readFileSync, writeFileSync } from 'node:fs';
import { valid } from 'semver';
import { dirSync } from 'tmp';
import type { ChangelogRenderer } from '../../../release/changelog-renderer';
import { readNxJson } from '../../config/nx-json';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { FsTree, Tree } from '../../generators/tree';
import { registerTsProject } from '../../plugins/js/utils/register';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { interpolate } from '../../tasks-runner/utils';
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
  getFirstGitCommit,
  getGitDiff,
  getLatestGitTagForPattern,
  gitAdd,
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
import { resolveNxJsonConfigErrorMessage } from './utils/resolve-nx-json-error-message';
import {
  ReleaseVersion,
  VersionData,
  commitChanges,
  createCommitMessageValues,
  createGitTagValues,
  handleDuplicateGitTags,
} from './utils/shared';

type PostGitTask = (latestCommit: string) => Promise<void>;

export const releaseChangelogCLIHandler = (args: ChangelogOptions) =>
  handleErrors(args.verbose, () => releaseChangelog(args));

/**
 * NOTE: This function is also exported for programmatic usage and forms part of the public API
 * of Nx. We intentionally do not wrap the implementation with handleErrors because users need
 * to have control over their own error handling when using the API.
 */
export async function releaseChangelog(
  args: ChangelogOptions
): Promise<number> {
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

  // The nx release top level command will always override these three git args. This is how we can tell
  // if the top level release command was used or if the user is using the changelog subcommand.
  // If the user explicitly overrides these args, then it doesn't matter if the top level config is set,
  // as all of the git options would be overridden anyway.
  if (
    (args.gitCommit === undefined ||
      args.gitTag === undefined ||
      args.stageChanges === undefined) &&
    nxJson.release?.git
  ) {
    const nxJsonMessage = await resolveNxJsonConfigErrorMessage([
      'release',
      'git',
    ]);
    output.error({
      title: `The "release.git" property in nx.json may not be used with the "nx release changelog" subcommand or programmatic API. Instead, configure git options for subcommands directly with "release.version.git" and "release.changelog.git".`,
      bodyLines: [nxJsonMessage],
    });
    process.exit(1);
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

  const changelogGenerationEnabled =
    !!nxReleaseConfig.changelog.workspaceChangelog ||
    Object.values(nxReleaseConfig.groups).some((g) => g.changelog);
  if (!changelogGenerationEnabled) {
    output.warn({
      title: `Changelogs are disabled. No changelog entries will be generated`,
      bodyLines: [
        `To explicitly enable changelog generation, configure "release.changelog.workspaceChangelog" or "release.changelog.projectChangelogs" in nx.json.`,
      ],
    });
    return 0;
  }

  const useAutomaticFromRef =
    nxReleaseConfig.changelog?.automaticFromRef || args.firstRelease;

  /**
   * For determining the versions to use within changelog files, there are a few different possibilities:
   * - the user is using the nx CLI, and therefore passes a single --version argument which represents the version for any and all changelog
   * files which will be generated (i.e. both the workspace changelog, and all project changelogs, depending on which of those has been enabled)
   * - the user is using the nxReleaseChangelog API programmatically, and:
   *   - passes only a version property
   *     - this works in the same way as described above for the CLI
   *   - passes only a versionData object
   *     - this is a special case where the user is providing a version for each project, and therefore the version argument is not needed
   *     - NOTE: it is not possible to generate a workspace level changelog with only a versionData object, and this will produce an error
   *   - passes both a version and a versionData object
   *     - in this case, the version property will be used as the reference for the workspace changelog, and the versionData object will be used
   *    to generate project changelogs
   */
  const { workspaceChangelogVersion, projectsVersionData } =
    resolveChangelogVersions(
      args,
      releaseGroups,
      releaseGroupToFilteredProjects
    );

  const to = args.to || 'HEAD';
  const toSHA = await getCommitHash(to);
  const headSHA = to === 'HEAD' ? toSHA : await getCommitHash('HEAD');

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

  const tree = new FsTree(workspaceRoot, args.verbose);

  const commitMessage: string | undefined =
    args.gitCommitMessage || nxReleaseConfig.changelog.git.commitMessage;

  const commitMessageValues: string[] = createCommitMessageValues(
    releaseGroups,
    releaseGroupToFilteredProjects,
    projectsVersionData,
    commitMessage
  );

  // Resolve any git tags as early as possible so that we can hard error in case of any duplicates before reaching the actual git command
  const gitTagValues: string[] =
    args.gitTag ?? nxReleaseConfig.changelog.git.tag
      ? createGitTagValues(
          releaseGroups,
          releaseGroupToFilteredProjects,
          projectsVersionData
        )
      : [];
  handleDuplicateGitTags(gitTagValues);

  const postGitTasks: PostGitTask[] = [];

  let workspaceChangelogFromRef =
    args.from ||
    (await getLatestGitTagForPattern(nxReleaseConfig.releaseTagPattern))?.tag;
  if (!workspaceChangelogFromRef) {
    if (useAutomaticFromRef) {
      workspaceChangelogFromRef = await getFirstGitCommit();
      if (args.verbose) {
        console.log(
          `Determined workspace --from ref from the first commit in workspace: ${workspaceChangelogFromRef}`
        );
      }
    } else {
      throw new Error(
        `Unable to determine the previous git tag. If this is the first release of your workspace, use the --first-release option or set the "release.changelog.automaticFromRef" config property in nx.json to generate a changelog from the first commit. Otherwise, be sure to configure the "release.releaseTagPattern" property in nx.json to match the structure of your repository's git tags.`
      );
    }
  }

  // Make sure that the fromRef is actually resolvable
  const workspaceChangelogFromSHA = await getCommitHash(
    workspaceChangelogFromRef
  );

  const workspaceChangelogCommits = await getCommits(
    workspaceChangelogFromSHA,
    toSHA
  );

  await generateChangelogForWorkspace(
    tree,
    args,
    projectGraph,
    nxReleaseConfig,
    workspaceChangelogVersion,
    workspaceChangelogCommits,
    postGitTasks
  );

  for (const releaseGroup of releaseGroups) {
    const config = releaseGroup.changelog;
    // The entire feature is disabled at the release group level, exit early
    if (config === false) {
      continue;
    }

    const projects = args.projects?.length
      ? // If the user has passed a list of projects, we need to use the filtered list of projects within the release group
        Array.from(releaseGroupToFilteredProjects.get(releaseGroup))
      : // Otherwise, we use the full list of projects within the release group
        releaseGroup.projects;
    const projectNodes = projects.map((name) => projectGraph.nodes[name]);

    if (releaseGroup.projectsRelationship === 'independent') {
      for (const project of projectNodes) {
        let fromRef =
          args.from ||
          (
            await getLatestGitTagForPattern(releaseGroup.releaseTagPattern, {
              projectName: project.name,
            })
          )?.tag;

        let commits: GitCommit[] | null = null;

        if (!fromRef && useAutomaticFromRef) {
          const firstCommit = await getFirstGitCommit();
          const allCommits = await getCommits(firstCommit, toSHA);
          const commitsForProject = allCommits.filter((c) =>
            c.affectedFiles.find((f) => f.startsWith(project.data.root))
          );

          fromRef = commitsForProject[0]?.shortHash;
          if (args.verbose) {
            console.log(
              `Determined --from ref for ${project.name} from the first commit in which it exists: ${fromRef}`
            );
          }
          commits = commitsForProject;
        }

        if (!fromRef && !commits) {
          throw new Error(
            `Unable to determine the previous git tag. If this is the first release of your workspace, use the --first-release option or set the "release.changelog.automaticFromRef" config property in nx.json to generate a changelog from the first commit. Otherwise, be sure to configure the "release.releaseTagPattern" property in nx.json to match the structure of your repository's git tags.`
          );
        }

        if (!commits) {
          commits = await getCommits(fromRef, toSHA);
        }

        await generateChangelogForProjects(
          tree,
          args,
          projectGraph,
          commits,
          projectsVersionData,
          postGitTasks,
          releaseGroup,
          [project]
        );
      }
    } else {
      const fromRef =
        args.from ||
        (await getLatestGitTagForPattern(releaseGroup.releaseTagPattern))?.tag;
      if (!fromRef) {
        throw new Error(
          `Unable to determine the previous git tag, please provide an explicit git reference using --from`
        );
      }

      // Make sure that the fromRef is actually resolvable
      const fromSHA = await getCommitHash(fromRef);

      const commits = await getCommits(fromSHA, toSHA);

      await generateChangelogForProjects(
        tree,
        args,
        projectGraph,
        commits,
        projectsVersionData,
        postGitTasks,
        releaseGroup,
        projectNodes
      );
    }
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

function resolveChangelogVersions(
  args: ChangelogOptions,
  releaseGroups: ReleaseGroupWithName[],
  releaseGroupToFilteredProjects: Map<ReleaseGroupWithName, Set<string>>
): {
  workspaceChangelogVersion: string | undefined;
  projectsVersionData: VersionData;
} {
  if (!args.version && !args.versionData) {
    throw new Error(
      `You must provide a version string and/or a versionData object.`
    );
  }

  /**
   * TODO: revaluate this assumption holistically in a dedicated PR when we add support for calver
   * (e.g. the Release class also uses semver utils to check if prerelease).
   *
   * Right now, the given version must be valid semver in order to proceed
   */
  if (args.version && !valid(args.version)) {
    throw new Error(
      `The given version "${args.version}" is not a valid semver version. Please provide your version in the format "1.0.0", "1.0.0-beta.1" etc`
    );
  }

  const versionData: VersionData = releaseGroups.reduce(
    (versionData, releaseGroup) => {
      const releaseGroupProjectNames = Array.from(
        releaseGroupToFilteredProjects.get(releaseGroup)
      );
      for (const projectName of releaseGroupProjectNames) {
        if (!args.versionData) {
          versionData[projectName] = {
            newVersion: args.version,
            currentVersion: '', // not relevant within changelog/commit generation
            dependentProjects: [], // not relevant within changelog/commit generation
          };
          continue;
        }
        /**
         * In the case where a versionData object was provided, we need to make sure all projects are present,
         * otherwise it suggests a filtering mismatch between the version and changelog command invocations.
         */
        if (!args.versionData[projectName]) {
          throw new Error(
            `The provided versionData object does not contain a version for project "${projectName}". This suggests a filtering mismatch between the version and changelog command invocations.`
          );
        }
      }
      return versionData;
    },
    args.versionData || {}
  );

  return {
    workspaceChangelogVersion: args.version,
    projectsVersionData: versionData,
  };
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

  const changes = tree.listChanges();

  /**
   * In the case where we are expecting changelog file updates, but there is nothing
   * to flush from the tree, we exit early. This could happen we using conventional
   * commits, for example.
   */
  const changelogFilesEnabled = checkChangelogFilesEnabled(nxReleaseConfig);
  if (changelogFilesEnabled && !changes.length) {
    output.warn({
      title: `No changes detected for changelogs`,
      bodyLines: [
        `No changes were detected for any changelog files, so no changelog entries will be generated.`,
      ],
    });
    return 0;
  }

  // Generate a new commit for the changes, if configured to do so
  if (args.gitCommit ?? nxReleaseConfig.changelog.git.commit) {
    await commitChanges(
      changes.map((f) => f.path),
      !!args.dryRun,
      !!args.verbose,
      commitMessageValues,
      args.gitCommitArgs || nxReleaseConfig.changelog.git.commitArgs
    );
    // Resolve the commit we just made
    latestCommit = await getCommitHash('HEAD');
  } else if (
    (args.stageChanges ?? nxReleaseConfig.changelog.git.stageChanges) &&
    changes.length
  ) {
    output.logSingleLine(`Staging changed files with git`);
    await gitAdd({
      changedFiles: changes.map((f) => f.path),
      dryRun: args.dryRun,
      verbose: args.verbose,
    });
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
  projectGraph: ProjectGraph,
  nxReleaseConfig: NxReleaseConfig,
  workspaceChangelogVersion: (string | null) | undefined,
  commits: GitCommit[],
  postGitTasks: PostGitTask[]
) {
  const config = nxReleaseConfig.changelog.workspaceChangelog;
  // The entire feature is disabled at the workspace level, exit early
  if (config === false) {
    return;
  }

  // If explicitly null it must mean that no changes were detected (e.g. when using conventional commits), so do nothing
  if (workspaceChangelogVersion === null) {
    return;
  }

  // The user explicitly passed workspaceChangelog=true but does not have a workspace changelog config in nx.json
  if (!config) {
    throw new Error(
      `Workspace changelog is enabled but no configuration was provided. Please provide a workspaceChangelog object in your nx.json`
    );
  }

  if (Object.entries(nxReleaseConfig.groups).length > 1) {
    output.warn({
      title: `Workspace changelog is enabled, but you have multiple release groups configured. This is not supported, so workspace changelog will be disabled.`,
      bodyLines: [
        `A single workspace version cannot be determined when defining multiple release groups because versions differ between each group.`,
        `Project level changelogs can be enabled with the "release.changelog.projectChangelogs" property.`,
      ],
    });
    return;
  }

  if (
    Object.values(nxReleaseConfig.groups)[0].projectsRelationship ===
    'independent'
  ) {
    output.warn({
      title: `Workspace changelog is enabled, but you have configured an independent projects relationship. This is not supported, so workspace changelog will be disabled.`,
      bodyLines: [
        `A single workspace version cannot be determined when using independent projects because versions differ between each project.`,
        `Project level changelogs can be enabled with the "release.changelog.projectChangelogs" property.`,
      ],
    });
    return;
  }

  // Only trigger interactive mode for the workspace changelog if the user explicitly requested it via "all" or "workspace"
  const interactive =
    args.interactive === 'all' || args.interactive === 'workspace';
  const dryRun = !!args.dryRun;
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
    version: workspaceChangelogVersion,
    releaseTagPattern: nxReleaseConfig.releaseTagPattern,
  });

  // We are either creating/previewing a changelog file, a GitHub release, or both
  let logTitle = dryRun ? 'Previewing a' : 'Generating a';
  switch (true) {
    case interpolatedTreePath && config.createRelease === 'github':
      logTitle += ` GitHub release and an entry in ${interpolatedTreePath} for ${chalk.white(
        releaseVersion.gitTag
      )}`;
      break;
    case !!interpolatedTreePath:
      logTitle += `n entry in ${interpolatedTreePath} for ${chalk.white(
        releaseVersion.gitTag
      )}`;
      break;
    case config.createRelease === 'github':
      logTitle += ` GitHub release for ${chalk.white(releaseVersion.gitTag)}`;
  }

  output.log({
    title: logTitle,
  });

  const githubRepoSlug = getGitHubRepoSlug(gitRemote);

  let contents = await changelogRenderer({
    projectGraph,
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
   * a changelog file, a GitHub release, or both.
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

  if (config.createRelease === 'github') {
    if (!githubRepoSlug) {
      output.error({
        title: `Unable to create a GitHub release because the GitHub repo slug could not be determined.`,
        bodyLines: [
          `Please ensure you have a valid GitHub remote configured. You can run \`git remote -v\` to list your current remotes.`,
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
          title: `Unable to resolve data via the GitHub API. You can use any of the following options to resolve this:`,
          bodyLines: [
            '- Set the `GITHUB_TOKEN` or `GH_TOKEN` environment variable to a valid GitHub token with `repo` scope',
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
  projectGraph: ProjectGraph,
  commits: GitCommit[],
  projectsVersionData: VersionData,
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

    /**
     * newVersion will be null in the case that no changes were detected (e.g. in conventional commits mode),
     * no changelog entry is relevant in that case.
     */
    if (projectsVersionData[project.name].newVersion === null) {
      continue;
    }

    const releaseVersion = new ReleaseVersion({
      version: projectsVersionData[project.name].newVersion,
      releaseTagPattern: releaseGroup.releaseTagPattern,
      projectName: project.name,
    });

    // We are either creating/previewing a changelog file, a GitHub release, or both
    let logTitle = dryRun ? 'Previewing a' : 'Generating a';
    switch (true) {
      case interpolatedTreePath && config.createRelease === 'github':
        logTitle += ` GitHub release and an entry in ${interpolatedTreePath} for ${chalk.white(
          releaseVersion.gitTag
        )}`;
        break;
      case !!interpolatedTreePath:
        logTitle += `n entry in ${interpolatedTreePath} for ${chalk.white(
          releaseVersion.gitTag
        )}`;
        break;
      case config.createRelease === 'github':
        logTitle += ` GitHub release for ${chalk.white(releaseVersion.gitTag)}`;
    }

    output.log({
      title: logTitle,
    });

    const githubRepoSlug =
      config.createRelease === 'github'
        ? getGitHubRepoSlug(gitRemote)
        : undefined;

    let contents = await changelogRenderer({
      projectGraph,
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
     * a changelog file, a GitHub release, or both.
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
          title: `Unable to create a GitHub release because the GitHub repo slug could not be determined.`,
          bodyLines: [
            `Please ensure you have a valid GitHub remote configured. You can run \`git remote -v\` to list your current remotes.`,
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
            title: `Unable to resolve data via the GitHub API. You can use any of the following options to resolve this:`,
            bodyLines: [
              '- Set the `GITHUB_TOKEN` or `GH_TOKEN` environment variable to a valid GitHub token with `repo` scope',
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
          await gitPush(gitRemote);

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

function checkChangelogFilesEnabled(nxReleaseConfig: NxReleaseConfig): boolean {
  if (
    nxReleaseConfig.changelog.workspaceChangelog &&
    nxReleaseConfig.changelog.workspaceChangelog.file
  ) {
    return true;
  }
  for (const releaseGroup of Object.values(nxReleaseConfig.groups)) {
    if (releaseGroup.changelog && releaseGroup.changelog.file) {
      return true;
    }
  }
  return false;
}

async function getCommits(fromSHA: string, toSHA: string) {
  const rawCommits = await getGitDiff(fromSHA, toSHA);
  // Parse as conventional commits
  return parseCommits(rawCommits).filter((c) => {
    const type = c.type;
    // Always ignore non user-facing commits for now
    // TODO: allow this filter to be configurable via config in a future release
    if (type === 'feat' || type === 'fix' || type === 'perf') {
      return true;
    }
    return false;
  });
}

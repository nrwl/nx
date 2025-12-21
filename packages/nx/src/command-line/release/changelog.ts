import * as chalk from 'chalk';
import { prompt } from 'enquirer';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { prerelease } from 'semver';
import { dirSync } from 'tmp';
import type { DependencyBump } from '../../../release/changelog-renderer';
import { NxReleaseConfiguration, readNxJson } from '../../config/nx-json';
import { ProjectGraphProjectNode } from '../../config/project-graph';
import { FsTree, Tree } from '../../generators/tree';
import {
  createFileMapUsingProjectGraph,
  createProjectFileMapUsingProjectGraph,
} from '../../project-graph/file-map-utils';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { interpolate } from '../../tasks-runner/utils';
import { handleErrors } from '../../utils/handle-errors';
import { isCI } from '../../utils/is-ci';
import { output } from '../../utils/output';
import { joinPathFragments } from '../../utils/path';
import { workspaceRoot } from '../../utils/workspace-root';
import {
  createChangesFromCommits,
  createFileToProjectMap,
  filterHiddenChanges,
  mapCommitToChange,
} from './changelog/commit-utils';
import {
  filterVersionPlansByCommitRange,
  resolveChangelogFromSHA,
  resolveWorkspaceChangelogFromSHA,
} from './changelog/version-plan-filtering';
import {
  ChangelogChange,
  createChangesFromGroupVersionPlans,
  createChangesFromProjectsVersionPlans,
} from './changelog/version-plan-utils';
import { ChangelogOptions } from './command-object';
import {
  NxReleaseConfig,
  ResolvedCreateRemoteReleaseProvider,
  createNxReleaseConfig,
  handleNxReleaseConfigError,
} from './config/config';
import { deepMergeJson } from './config/deep-merge-json';
import { ReleaseGroupWithName } from './config/filter-release-groups';
import {
  GroupVersionPlan,
  ProjectsVersionPlan,
  readRawVersionPlans,
  setResolvedVersionPlansOnGroups,
} from './config/version-plans';
import {
  GitCommit,
  getCommitHash,
  getGitDiff,
  gitAdd,
  gitPush,
  gitTag,
  parseCommits,
} from './utils/git';
import { launchEditor } from './utils/launch-editor';
import { parseChangelogMarkdown } from './utils/markdown';
import { printAndFlushChanges } from './utils/print-changes';
import { printConfigAndExit } from './utils/print-config';
import { ReleaseGraph, createReleaseGraph } from './utils/release-graph';
import { createRemoteReleaseClient } from './utils/remote-release-clients/remote-release-client';
import type { CheckAllBranchesWhen } from './utils/repository-git-tags';
import { resolveChangelogRenderer } from './utils/resolve-changelog-renderer';
import { resolveNxJsonConfigErrorMessage } from './utils/resolve-nx-json-error-message';
import {
  ReleaseVersion,
  VersionData,
  commitChanges,
  createCommitMessageValues,
  createGitTagValues,
  handleDuplicateGitTags,
  isPrerelease,
  noDiffInChangelogMessage,
  shouldPreferDockerVersionForReleaseGroup,
} from './utils/shared';
import {
  areAllVersionPlanProjectsFiltered,
  validateResolvedVersionPlansAgainstFilter,
} from './utils/version-plan-utils';

export interface NxReleaseChangelogResult {
  workspaceChangelog?: {
    releaseVersion: ReleaseVersion;
    contents: string;
    postGitTask: PostGitTask | null;
  };
  projectChangelogs?: {
    [projectName: string]: {
      releaseVersion: ReleaseVersion;
      contents: string;
      postGitTask: PostGitTask | null;
    };
  };
}

// ChangelogChange is now exported from ./changelog/version-plan-utils
export type { ChangelogChange } from './changelog/version-plan-utils';

export type PostGitTask = (latestCommit: string) => Promise<void>;

export const releaseChangelogCLIHandler = (args: ChangelogOptions) =>
  handleErrors(args.verbose, () => createAPI({}, false)(args));

export function createAPI(
  overrideReleaseConfig: NxReleaseConfiguration,
  ignoreNxJsonConfig: boolean
) {
  /**
   * NOTE: This function is also exported for programmatic usage and forms part of the public API
   * of Nx. We intentionally do not wrap the implementation with handleErrors because users need
   * to have control over their own error handling when using the API.
   */
  return async function releaseChangelog(
    args: ChangelogOptions
  ): Promise<NxReleaseChangelogResult> {
    const projectGraph = await createProjectGraphAsync({ exitOnError: true });
    const overriddenConfig = overrideReleaseConfig ?? {};
    const userProvidedReleaseConfig = ignoreNxJsonConfig
      ? overriddenConfig
      : deepMergeJson(readNxJson().release ?? {}, overriddenConfig);

    // Apply default configuration to any optional user configuration
    const { error: configError, nxReleaseConfig } = await createNxReleaseConfig(
      projectGraph,
      await createProjectFileMapUsingProjectGraph(projectGraph),
      userProvidedReleaseConfig
    );
    if (configError) {
      return await handleNxReleaseConfigError(configError);
    }
    // --print-config exits directly as it is not designed to be combined with any other programmatic operations
    if (args.printConfig) {
      return printConfigAndExit({
        userProvidedReleaseConfig,
        nxReleaseConfig,
        isDebug: args.printConfig === 'debug',
      });
    }

    // The nx release top level command will always override these three git args. This is how we can tell
    // if the top level release command was used or if the user is using the changelog subcommand.
    // If the user explicitly overrides these args, then it doesn't matter if the top level config is set,
    // as all of the git options would be overridden anyway.
    if (
      (args.gitCommit === undefined ||
        args.gitTag === undefined ||
        args.stageChanges === undefined) &&
      userProvidedReleaseConfig.git
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

    const tree = new FsTree(workspaceRoot, args.verbose);

    // Use pre-built release graph if provided, otherwise create a new one
    const releaseGraph: ReleaseGraph =
      args.releaseGraph ||
      (await createReleaseGraph({
        tree,
        projectGraph,
        nxReleaseConfig,
        filters: {
          projects: args.projects,
          groups: args.groups,
        },
        firstRelease: args.firstRelease,
        verbose: args.verbose,
      }));

    // Display filter log if filters were applied (only when graph was created, not reused)
    if (
      !args.releaseGraph &&
      releaseGraph.filterLog &&
      process.env.NX_RELEASE_INTERNAL_SUPPRESS_FILTER_LOG !== 'true'
    ) {
      output.note(releaseGraph.filterLog);
    }

    let rawVersionPlans = await readRawVersionPlans();

    if (args.deleteVersionPlans === undefined) {
      // default to deleting version plans in this command instead of after versioning
      args.deleteVersionPlans = true;
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
      return {};
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
      resolveChangelogVersions(args, releaseGraph);

    const to = args.to || 'HEAD';
    const toSHA = await getCommitHash(to);
    const headSHA = to === 'HEAD' ? toSHA : await getCommitHash('HEAD');

    // Resolve the from SHA once for reuse across different contexts
    const fromSHA = await resolveWorkspaceChangelogFromSHA({
      args,
      nxReleaseConfig,
      useAutomaticFromRef,
      resolveRepositoryTags: releaseGraph.resolveRepositoryTags,
    });

    // Filter version plans based on resolveVersionPlans option
    const shouldFilterVersionPlans =
      args.resolveVersionPlans === 'using-from-and-to';
    if (shouldFilterVersionPlans && rawVersionPlans.length > 0 && fromSHA) {
      rawVersionPlans = await filterVersionPlansByCommitRange(
        rawVersionPlans,
        fromSHA,
        toSHA,
        args.verbose
      );

      if (args.verbose) {
        console.log(
          `Using version plans committed between ${fromSHA} and ${toSHA}`
        );
      }
    }

    // Set resolved version plans on groups
    await setResolvedVersionPlansOnGroups(
      rawVersionPlans,
      releaseGraph.releaseGroups,
      Object.keys(projectGraph.nodes),
      args.verbose
    );

    // Validate version plans against the filter after resolution
    const versionPlanValidationError =
      validateResolvedVersionPlansAgainstFilter(
        releaseGraph.releaseGroups,
        releaseGraph.releaseGroupToFilteredProjects
      );
    if (versionPlanValidationError) {
      output.error(versionPlanValidationError);
      process.exit(1);
    }

    /**
     * Extract the preid from the workspace version and the project versions
     */
    const workspacePreid: string | undefined = workspaceChangelogVersion
      ? extractPreid(workspaceChangelogVersion)
      : undefined;

    const projectsPreid: { [projectName: string]: string | undefined } =
      Object.fromEntries(
        Object.entries(projectsVersionData).map(([projectName, v]) => [
          projectName,
          v.newVersion ? extractPreid(v.newVersion) : undefined,
        ])
      );

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

    const commitMessage: string | undefined =
      args.gitCommitMessage || nxReleaseConfig.changelog.git.commitMessage;

    const commitMessageValues: string[] = createCommitMessageValues(
      releaseGraph.releaseGroups,
      releaseGraph.releaseGroupToFilteredProjects,
      projectsVersionData,
      commitMessage
    );

    // Resolve any git tags as early as possible so that we can hard error in case of any duplicates before reaching the actual git command
    const gitTagValues: string[] =
      (args.gitTag ?? nxReleaseConfig.changelog.git.tag)
        ? createGitTagValues(
            releaseGraph.releaseGroups,
            releaseGraph.releaseGroupToFilteredProjects,
            projectsVersionData
          )
        : [];
    handleDuplicateGitTags(gitTagValues);

    const postGitTasks: PostGitTask[] = [];

    const workspaceChangelogChanges = await resolveWorkspaceChangelogChanges({
      releaseGraph,
      nxReleaseConfig,
      args,
      workspacePreid,
      projectsPreid,
      useAutomaticFromRef,
      toSHA,
      fromSHA,
    });

    const workspaceChangelog = await generateChangelogForWorkspace({
      tree,
      args,
      nxReleaseConfig,
      workspaceChangelogVersion,
      changes: workspaceChangelogChanges,
    });

    // Add the post git task (e.g. create a remote release) for the workspace changelog, if applicable
    if (workspaceChangelog && workspaceChangelog.postGitTask) {
      postGitTasks.push(workspaceChangelog.postGitTask);
    }

    /**
     * Create a cache for from SHA resolution to avoid duplicate git operations
     */
    const fromSHACache = new Map<string, string | null>();
    // Cache the workspace from SHA if available
    if (fromSHA) {
      fromSHACache.set('workspace', fromSHA);
    }

    // Helper function to get cached from SHA or resolve and cache it
    const getCachedFromSHA = async (
      cacheKey: string,
      pattern: string,
      templateValues: Record<string, string>,
      preid: string | undefined,
      checkAllBranchesWhen: CheckAllBranchesWhen,
      requireSemver: boolean,
      strictPreid: boolean
    ): Promise<string | null> => {
      if (fromSHACache.has(cacheKey)) {
        return fromSHACache.get(cacheKey);
      }
      const sha = await resolveChangelogFromSHA({
        fromRef: args.from,
        tagPattern: pattern,
        tagPatternValues: templateValues,
        resolveRepositoryTags: releaseGraph.resolveRepositoryTags,
        checkAllBranchesWhen,
        preid,
        requireSemver,
        strictPreid,
        useAutomaticFromRef,
      });
      fromSHACache.set(cacheKey, sha);
      return sha;
    };

    /**
     * Compute any additional dependency bumps up front because there could be cases of circular dependencies,
     * and figuring them out during the main iteration would be too late.
     */
    const projectToAdditionalDependencyBumps = new Map<
      string,
      DependencyBump[]
    >();
    for (const releaseGroup of releaseGraph.releaseGroups) {
      if (releaseGroup.projectsRelationship !== 'independent') {
        continue;
      }
      for (const project of releaseGroup.projects) {
        // If the project does not have any changes, do not process its dependents
        if (
          !projectsVersionData[project] ||
          projectsVersionData[project].newVersion === null
        ) {
          continue;
        }

        const dependentProjects = (
          projectsVersionData[project].dependentProjects || []
        )
          .map((dep) => {
            return {
              dependencyName: dep.source,
              newVersion: projectsVersionData[dep.source]?.newVersion ?? null,
            };
          })
          .filter((b) => b.newVersion !== null);

        for (const dependent of dependentProjects) {
          const additionalDependencyBumpsForProject =
            projectToAdditionalDependencyBumps.has(dependent.dependencyName)
              ? projectToAdditionalDependencyBumps.get(dependent.dependencyName)
              : [];
          additionalDependencyBumpsForProject.push({
            dependencyName: project,
            newVersion: projectsVersionData[project].newVersion,
          });
          projectToAdditionalDependencyBumps.set(
            dependent.dependencyName,
            additionalDependencyBumpsForProject
          );
        }
      }
    }

    const allProjectChangelogs: NxReleaseChangelogResult['projectChangelogs'] =
      {};

    for (const releaseGroup of releaseGraph.releaseGroups) {
      const config = releaseGroup.changelog;
      // The entire feature is disabled at the release group level, exit early
      if (config === false) {
        continue;
      }

      const projects = args.projects?.length
        ? // If the user has passed a list of projects, we need to use the filtered list of projects within the release group, plus any dependents
          Array.from(
            releaseGraph.releaseGroupToFilteredProjects.get(releaseGroup)
          ).flatMap((project) => {
            return [
              project,
              ...(projectsVersionData[project]?.dependentProjects.map(
                (dep) => dep.source
              ) || []),
            ];
          })
        : // Otherwise, we use the full list of projects within the release group
          releaseGroup.projects;
      const projectNodes = projects.map((name) => projectGraph.nodes[name]);

      if (releaseGroup.projectsRelationship === 'independent') {
        for (const project of projectNodes) {
          let changes: ChangelogChange[] | null = null;

          if (releaseGroup.resolvedVersionPlans) {
            changes = createChangesFromProjectsVersionPlans(
              releaseGroup.resolvedVersionPlans as ProjectsVersionPlan[],
              project.name
            );
          } else {
            const projectCacheKey = `${releaseGroup.name}:${project.name}`;
            const fromSHA = await getCachedFromSHA(
              projectCacheKey,
              releaseGroup.releaseTag.pattern,
              {
                projectName: project.name,
                releaseGroupName: releaseGroup.name,
              },
              projectsPreid[project.name],
              releaseGroup.releaseTag.checkAllBranchesWhen,
              releaseGroup.releaseTag.requireSemver,
              releaseGroup.releaseTag.strictPreid
            );

            let commits: GitCommit[];
            let fromRef = fromSHA;
            if (!fromRef && useAutomaticFromRef) {
              // For automatic from ref, we already have it cached
              fromRef = fromSHACache.get(projectCacheKey);
              if (fromRef) {
                commits = await filterProjectCommits({
                  fromSHA: fromRef,
                  toSHA,
                  projectPath: project.data.root,
                });

                fromRef = commits[0]?.shortHash;
                if (args.verbose) {
                  console.log(
                    `Determined --from ref for ${project.name} from the first commit in which it exists: ${fromRef}`
                  );
                }
              }
            }

            if (!fromRef && !commits) {
              throw new Error(
                `Unable to determine the previous git tag. If this is the first release of your workspace, use the --first-release option or set the "release.changelog.automaticFromRef" config property in nx.json to generate a changelog from the first commit. Otherwise, be sure to configure the "release.releaseTag.pattern" property in nx.json to match the structure of your repository's git tags.`
              );
            }

            if (!commits) {
              commits = await filterProjectCommits({
                fromSHA: fromRef,
                toSHA,
                projectPath: project.data.root,
              });
            }

            const { fileMap } =
              await createFileMapUsingProjectGraph(projectGraph);
            const fileToProjectMap = createFileToProjectMap(
              fileMap.projectFileMap
            );

            changes = createChangesFromCommits(
              commits,
              fileMap,
              fileToProjectMap,
              nxReleaseConfig.conventionalCommits
            );
          }

          const projectChangelogs = await generateChangelogForProjects({
            tree,
            args,
            changes,
            projectsVersionData,
            releaseGroup,
            projects: [project],
            nxReleaseConfig,
            projectToAdditionalDependencyBumps,
          });

          if (projectChangelogs) {
            for (const [projectName, projectChangelog] of Object.entries(
              projectChangelogs
            )) {
              // Add the post git task (e.g. create a remote release) for the project changelog, if applicable
              if (projectChangelog.postGitTask) {
                postGitTasks.push(projectChangelog.postGitTask);
              }
              allProjectChangelogs[projectName] = projectChangelog;
            }
          }
        }
      } else {
        let changes: ChangelogChange[] = [];
        if (releaseGroup.resolvedVersionPlans) {
          // This is identical to workspace changelog for fixed groups
          changes = createChangesFromGroupVersionPlans(
            releaseGroup.resolvedVersionPlans as GroupVersionPlan[]
          );
        } else {
          const groupCacheKey = `${releaseGroup.name}:fixed`;
          const fromSHA = await getCachedFromSHA(
            groupCacheKey,
            releaseGroup.releaseTag.pattern,
            {},
            workspacePreid ?? projectsPreid?.[Object.keys(projectsPreid)[0]],
            releaseGroup.releaseTag.checkAllBranchesWhen,
            releaseGroup.releaseTag.requireSemver,
            releaseGroup.releaseTag.strictPreid
          );

          if (!fromSHA) {
            throw new Error(
              `Unable to determine the previous git tag. If this is the first release of your release group, use the --first-release option or set the "release.changelog.automaticFromRef" config property in nx.json to generate a changelog from the first commit. Otherwise, be sure to configure the "release.releaseTag.pattern" property in nx.json to match the structure of your repository's git tags.`
            );
          }

          if (args.verbose && useAutomaticFromRef && !args.from) {
            console.log(
              `Determined release group --from ref from the first commit in the workspace: ${fromSHA}`
            );
          }

          const { fileMap } =
            await createFileMapUsingProjectGraph(projectGraph);
          const fileToProjectMap = createFileToProjectMap(
            fileMap.projectFileMap
          );

          const commits = await getCommits(fromSHA, toSHA);
          changes = createChangesFromCommits(
            commits,
            fileMap,
            fileToProjectMap,
            nxReleaseConfig.conventionalCommits
          );
        }

        const projectChangelogs = await generateChangelogForProjects({
          tree,
          args,
          changes,
          projectsVersionData,
          releaseGroup,
          projects: projectNodes,
          nxReleaseConfig,
          projectToAdditionalDependencyBumps,
        });

        if (projectChangelogs) {
          for (const [projectName, projectChangelog] of Object.entries(
            projectChangelogs
          )) {
            // Add the post git task (e.g. create a remote release) for the project changelog, if applicable
            if (projectChangelog.postGitTask) {
              postGitTasks.push(projectChangelog.postGitTask);
            }
            allProjectChangelogs[projectName] = projectChangelog;
          }
        }
      }
    }

    await applyChangesAndExit(
      args,
      nxReleaseConfig,
      tree,
      toSHA,
      postGitTasks,
      commitMessageValues,
      gitTagValues,
      releaseGraph
    );

    return {
      workspaceChangelog,
      projectChangelogs: allProjectChangelogs,
    };
  };
}

function resolveChangelogVersions(
  args: ChangelogOptions,
  releaseGraph: ReleaseGraph
): {
  workspaceChangelogVersion: string | undefined;
  projectsVersionData: VersionData;
} {
  if (!args.version && !args.versionData) {
    throw new Error(
      `You must provide a version string and/or a versionData object.`
    );
  }

  const versionData: VersionData = releaseGraph.releaseGroups.reduce(
    (versionData, releaseGroup) => {
      const releaseGroupProjectNames = Array.from(
        releaseGraph.releaseGroupToFilteredProjects.get(releaseGroup)
      );
      for (const projectName of releaseGroupProjectNames) {
        if (!args.versionData) {
          versionData[projectName] = {
            dockerVersion: args.version,
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
            `The provided versionData object does not contain a version for project "${projectName}". This suggests a filtering mismatch between the version and changelog command invocations. Please ensure that you have used the same "group" or "project" filter between commands.`
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

// Can be overridden to something more specific as we resolve the remote release client within nested logic
let remoteReleaseProviderName: undefined | string;

// If already set, and not the same as the remote release client, append
function applyRemoteReleaseProviderName(newRemoteReleaseProviderName: string) {
  if (remoteReleaseProviderName) {
    if (remoteReleaseProviderName !== newRemoteReleaseProviderName) {
      remoteReleaseProviderName = `${remoteReleaseProviderName}/${newRemoteReleaseProviderName}`;
    }
  } else {
    remoteReleaseProviderName = newRemoteReleaseProviderName;
  }
}

async function applyChangesAndExit(
  args: ChangelogOptions,
  nxReleaseConfig: NxReleaseConfig,
  tree: Tree,
  toSHA: string,
  postGitTasks: PostGitTask[],
  commitMessageValues: string[],
  gitTagValues: string[],
  releaseGraph: ReleaseGraph
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

    if (!postGitTasks.length) {
      // No post git tasks (e.g. remote release creation) to perform so we can just exit
      return;
    }

    if (isCI()) {
      output.warn({
        title: `Skipped ${
          remoteReleaseProviderName ?? 'remote'
        } release creation because no changes were detected for any changelog files.`,
      });
      return;
    }

    /**
     * Prompt the user to see if they want to create a remote release anyway.
     * We know that the user has configured remote releases because we have postGitTasks.
     */
    const shouldCreateRemoteReleaseAnyway = await promptForRemoteRelease();
    if (!shouldCreateRemoteReleaseAnyway) {
      return;
    }

    for (const postGitTask of postGitTasks) {
      await postGitTask(latestCommit);
    }

    return;
  }

  const changedFiles: string[] = changes.map((f) => f.path);

  let deletedFiles: string[] = [];
  if (args.deleteVersionPlans) {
    const planFiles = new Set<string>();
    releaseGraph.releaseGroups.forEach((group) => {
      const filteredProjects =
        releaseGraph.releaseGroupToFilteredProjects.get(group);

      if (group.resolvedVersionPlans) {
        // Check each version plan individually to see if it should be deleted
        const plansToDelete = [];

        for (const plan of group.resolvedVersionPlans) {
          // Only delete if ALL projects in the version plan are being filtered/released
          if (
            areAllVersionPlanProjectsFiltered(plan, group, filteredProjects)
          ) {
            plansToDelete.push(plan);
          }
        }

        // Delete the plans that only affect filtered projects
        plansToDelete.forEach((plan) => {
          if (!args.dryRun) {
            rmSync(plan.absolutePath, { recursive: true, force: true });
            if (args.verbose) {
              console.log(`Removing ${plan.relativePath}`);
            }
          } else {
            if (args.verbose) {
              console.log(
                `Would remove ${plan.relativePath}, but --dry-run was set`
              );
            }
          }
          planFiles.add(plan.relativePath);
        });
      }
    });
    deletedFiles = Array.from(planFiles);
  }

  // Generate a new commit for the changes, if configured to do so
  if (args.gitCommit ?? nxReleaseConfig.changelog.git.commit) {
    await commitChanges({
      changedFiles,
      deletedFiles,
      isDryRun: !!args.dryRun,
      isVerbose: !!args.verbose,
      gitCommitMessages: commitMessageValues,
      gitCommitArgs:
        args.gitCommitArgs || nxReleaseConfig.changelog.git.commitArgs,
    });
    // Resolve the commit we just made
    latestCommit = await getCommitHash('HEAD');
  } else if (
    (args.stageChanges ?? nxReleaseConfig.changelog.git.stageChanges) &&
    changes.length
  ) {
    output.logSingleLine(`Staging changed files with git`);
    await gitAdd({
      changedFiles,
      deletedFiles,
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

  if (args.gitPush ?? nxReleaseConfig.changelog.git.push) {
    output.logSingleLine(
      `Pushing to git remote "${args.gitRemote ?? 'origin'}"`
    );
    await gitPush({
      gitRemote: args.gitRemote,
      dryRun: args.dryRun,
      verbose: args.verbose,
      additionalArgs:
        args.gitPushArgs || nxReleaseConfig.changelog.git.pushArgs,
    });
  }

  // Run any post-git tasks in series
  for (const postGitTask of postGitTasks) {
    await postGitTask(latestCommit);
  }

  return;
}

async function generateChangelogForWorkspace({
  tree,
  args,
  nxReleaseConfig,
  workspaceChangelogVersion,
  changes,
}: {
  tree: Tree;
  args: ChangelogOptions;
  nxReleaseConfig: NxReleaseConfig;
  workspaceChangelogVersion: (string | null) | undefined;
  changes: ChangelogChange[];
}): Promise<NxReleaseChangelogResult['workspaceChangelog'] | undefined> {
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
        `A single workspace version cannot be determined when defining multiple release groups because versions can differ between each group.`,
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
        `A single workspace version cannot be determined when using independent projects because versions can differ between each project.`,
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

  const ChangelogRendererClass = resolveChangelogRenderer(config.renderer);

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
    releaseTagPattern: nxReleaseConfig.releaseTag.pattern,
    releaseGroupName: Object.keys(nxReleaseConfig.groups)[0],
  });

  if (interpolatedTreePath) {
    const prefix = dryRun ? 'Previewing' : 'Generating';
    output.log({
      title: `${prefix} an entry in ${interpolatedTreePath} for ${chalk.white(
        releaseVersion.gitTag
      )}`,
    });
  }

  const remoteReleaseClient = await createRemoteReleaseClient(
    config.createRelease as unknown as
      | false
      | ResolvedCreateRemoteReleaseProvider,
    gitRemote
  );
  applyRemoteReleaseProviderName(remoteReleaseClient.remoteReleaseProviderName);

  const changelogRenderer = new ChangelogRendererClass({
    changes,
    changelogEntryVersion: releaseVersion.rawVersion,
    project: null,
    isVersionPlans: !!nxReleaseConfig.versionPlans,
    entryWhenNoChanges: config.entryWhenNoChanges,
    changelogRenderOptions: config.renderOptions,
    conventionalCommitsConfig: nxReleaseConfig.conventionalCommits,
    remoteReleaseClient,
  });
  let contents = await changelogRenderer.render();

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

  if (interpolatedTreePath) {
    let rootChangelogContents = tree.exists(interpolatedTreePath)
      ? tree.read(interpolatedTreePath).toString()
      : '';
    if (rootChangelogContents && !args.replaceExistingContents) {
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
      // No existing changelog contents, or replaceExistingContents is true, simply use the generated contents directly
      rootChangelogContents = contents;
    }

    tree.write(interpolatedTreePath, rootChangelogContents);

    printAndFlushChanges(tree, !!dryRun, 3, false, noDiffInChangelogMessage);
  }

  const postGitTask: PostGitTask | null =
    args.createRelease !== false && config.createRelease
      ? remoteReleaseClient.createPostGitTask(releaseVersion, contents, dryRun)
      : null;

  return {
    releaseVersion,
    contents,
    postGitTask,
  };
}

async function generateChangelogForProjects({
  tree,
  args,
  changes,
  projectsVersionData,
  releaseGroup,
  projects,
  nxReleaseConfig,
  projectToAdditionalDependencyBumps,
}: {
  tree: Tree;
  args: ChangelogOptions;
  changes: ChangelogChange[];
  projectsVersionData: VersionData;
  releaseGroup: ReleaseGroupWithName;
  projects: ProjectGraphProjectNode[];
  nxReleaseConfig: NxReleaseConfig;
  projectToAdditionalDependencyBumps: Map<string, DependencyBump[]>;
}): Promise<NxReleaseChangelogResult['projectChangelogs'] | undefined> {
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

  const ChangelogRendererClass = resolveChangelogRenderer(config.renderer);

  // Maximum of one remote release client per release group
  const remoteReleaseClient = await createRemoteReleaseClient(
    config.createRelease as unknown as
      | false
      | ResolvedCreateRemoteReleaseProvider,
    gitRemote
  );
  applyRemoteReleaseProviderName(remoteReleaseClient.remoteReleaseProviderName);

  const projectChangelogs: NxReleaseChangelogResult['projectChangelogs'] = {};

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
    if (
      !projectsVersionData[project.name] ||
      (projectsVersionData[project.name].newVersion === null &&
        !projectsVersionData[project.name].dockerVersion)
    ) {
      continue;
    }

    const preferDockerVersion =
      shouldPreferDockerVersionForReleaseGroup(releaseGroup);
    const releaseVersion = new ReleaseVersion({
      version:
        (preferDockerVersion === true || preferDockerVersion === 'both') &&
        projectsVersionData[project.name].dockerVersion
          ? projectsVersionData[project.name].dockerVersion
          : projectsVersionData[project.name].newVersion,
      releaseTagPattern: releaseGroup.releaseTag.pattern,
      projectName: project.name,
      releaseGroupName: releaseGroup.name,
    });

    if (interpolatedTreePath) {
      const prefix = dryRun ? 'Previewing' : 'Generating';
      output.log({
        title: `${prefix} an entry in ${interpolatedTreePath} for ${chalk.white(
          releaseVersion.gitTag
        )}`,
      });
    }

    const changelogRenderer = new ChangelogRendererClass({
      changes,
      changelogEntryVersion: releaseVersion.rawVersion,
      project: project.name,
      entryWhenNoChanges:
        typeof config.entryWhenNoChanges === 'string'
          ? interpolate(config.entryWhenNoChanges, {
              projectName: project.name,
              projectRoot: project.data.root,
              workspaceRoot: '', // within the tree, workspaceRoot is the root
            })
          : false,
      changelogRenderOptions: config.renderOptions,
      isVersionPlans: !!releaseGroup.versionPlans,
      conventionalCommitsConfig: nxReleaseConfig.conventionalCommits,
      dependencyBumps: projectToAdditionalDependencyBumps.get(project.name),
      remoteReleaseClient,
    });
    let contents = await changelogRenderer.render();

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

    const postGitTask: PostGitTask | null =
      args.createRelease !== false && config.createRelease
        ? remoteReleaseClient.createPostGitTask(
            releaseVersion,
            contents,
            dryRun
          )
        : null;

    projectChangelogs[project.name] = {
      releaseVersion,
      contents,
      postGitTask,
    };
  }

  return projectChangelogs;
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

async function getCommits(
  fromSHA: string,
  toSHA: string
): Promise<GitCommit[]> {
  const rawCommits = await getGitDiff(fromSHA, toSHA);
  // Parse as conventional commits
  return parseCommits(rawCommits);
}

async function filterProjectCommits({
  fromSHA,
  toSHA,
  projectPath,
}: {
  fromSHA: string;
  toSHA: string;
  projectPath: string;
}) {
  const allCommits = await getCommits(fromSHA, toSHA);
  return allCommits.filter((c) =>
    c.affectedFiles.find((f) => f.startsWith(projectPath))
  );
}

async function promptForRemoteRelease(): Promise<boolean> {
  try {
    const result = await prompt<{ confirmation: boolean }>([
      {
        name: 'confirmation',
        message: `Do you want to create a ${
          remoteReleaseProviderName ?? 'remote'
        } release anyway?`,
        type: 'confirm',
      },
    ]);
    return result.confirmation;
  } catch {
    // Ensure the cursor is always restored
    process.stdout.write('\u001b[?25h');
    // Handle the case where the user exits the prompt with ctrl+c
    return false;
  }
}

async function resolveWorkspaceChangelogChanges({
  releaseGraph,
  nxReleaseConfig,
  args,
  workspacePreid,
  projectsPreid,
  useAutomaticFromRef,
  toSHA,
  fromSHA,
}: {
  releaseGraph: ReleaseGraph;
  nxReleaseConfig: NxReleaseConfig;
  args: ChangelogOptions;
  workspacePreid: string | undefined;
  projectsPreid: Record<string, string | undefined>;
  useAutomaticFromRef: boolean;
  toSHA: string;
  fromSHA: string | null;
}): Promise<ChangelogChange[]> {
  // NOTE: If there are multiple release groups, we'll just skip the workspace changelog anyway.
  const versionPlansEnabledForWorkspaceChangelog =
    releaseGraph.releaseGroups[0]?.resolvedVersionPlans;

  // Derive changes from version plan files
  if (versionPlansEnabledForWorkspaceChangelog) {
    return resolveWorkspaceChangelogFromVersionPlans(releaseGraph);
  }

  // Derive changes from commits
  return resolveWorkspaceChangelogFromCommits({
    nxReleaseConfig,
    args,
    workspacePreid,
    projectsPreid,
    useAutomaticFromRef,
    toSHA,
    fromSHA,
  });
}

function resolveWorkspaceChangelogFromVersionPlans(
  releaseGraph: ReleaseGraph
): ChangelogChange[] {
  const firstReleaseGroup = releaseGraph.releaseGroups[0];

  // We only produce a workspace changelog in the case of a single, fixed relationship release group
  if (
    releaseGraph.releaseGroups.length !== 1 ||
    firstReleaseGroup?.projectsRelationship !== 'fixed'
  ) {
    return [];
  }

  const versionPlans =
    firstReleaseGroup.resolvedVersionPlans as GroupVersionPlan[];
  return createChangesFromGroupVersionPlans(versionPlans);
}

async function resolveWorkspaceChangelogFromCommits({
  nxReleaseConfig,
  args,
  workspacePreid,
  projectsPreid,
  useAutomaticFromRef,
  toSHA,
  fromSHA,
}: {
  nxReleaseConfig: NxReleaseConfig;
  args: ChangelogOptions;
  workspacePreid: string | undefined;
  projectsPreid: Record<string, string | undefined>;
  useAutomaticFromRef: boolean;
  toSHA: string;
  fromSHA: string | null;
}): Promise<ChangelogChange[]> {
  // Use the cached fromSHA if available, otherwise throw an error
  if (!fromSHA) {
    throw new Error(
      `Unable to determine the previous git tag. If this is the first release of your workspace, use the --first-release option or set the "release.changelog.automaticFromRef" config property in nx.json to generate a changelog from the first commit. Otherwise, be sure to configure the "release.releaseTag.pattern" property in nx.json to match the structure of your repository's git tags.`
    );
  }

  const workspaceChangelogFromSHA = fromSHA;

  const commits = await getCommits(workspaceChangelogFromSHA, toSHA);
  // For workspace changelog, all commits affect all projects
  return filterHiddenChanges(
    commits.map((c) => mapCommitToChange(c, '*')),
    nxReleaseConfig.conventionalCommits
  );
}

function extractPreid(version: string): string | undefined {
  if (!isPrerelease(version)) {
    return undefined;
  }

  const preid = prerelease(version)?.[0];
  if (typeof preid === 'string') {
    if (preid.trim() === '') {
      return undefined;
    }

    return preid;
  }
  if (typeof preid === 'number') {
    return preid.toString();
  }
  return undefined;
}

import * as chalk from 'chalk';
import { prompt } from 'enquirer';
import { removeSync } from 'fs-extra';
import { readFileSync, writeFileSync } from 'node:fs';
import { valid } from 'semver';
import { dirSync } from 'tmp';
import type { DependencyBump } from '../../../release/changelog-renderer';
import {
  NxReleaseChangelogConfiguration,
  readNxJson,
} from '../../config/nx-json';
import {
  FileData,
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { FsTree, Tree } from '../../generators/tree';
import {
  createFileMapUsingProjectGraph,
  createProjectFileMapUsingProjectGraph,
} from '../../project-graph/file-map-utils';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { interpolate } from '../../tasks-runner/utils';
import { isCI } from '../../utils/is-ci';
import { output } from '../../utils/output';
import { handleErrors } from '../../utils/params';
import { joinPathFragments } from '../../utils/path';
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
  GroupVersionPlan,
  ProjectsVersionPlan,
  readRawVersionPlans,
  setVersionPlansOnGroups,
} from './config/version-plans';
import {
  GitCommit,
  Reference,
  getCommitHash,
  getFirstGitCommit,
  getGitDiff,
  getLatestGitTagForPattern,
  gitAdd,
  gitPush,
  gitTag,
  parseCommits,
  parseConventionalCommitsMessage,
} from './utils/git';
import { createOrUpdateGithubRelease, getGitHubRepoSlug } from './utils/github';
import { launchEditor } from './utils/launch-editor';
import { parseChangelogMarkdown } from './utils/markdown';
import { printAndFlushChanges } from './utils/print-changes';
import { resolveChangelogRenderer } from './utils/resolve-changelog-renderer';
import { resolveNxJsonConfigErrorMessage } from './utils/resolve-nx-json-error-message';
import {
  ReleaseVersion,
  VersionData,
  commitChanges,
  createCommitMessageValues,
  createGitTagValues,
  handleDuplicateGitTags,
  noDiffInChangelogMessage,
} from './utils/shared';

export interface NxReleaseChangelogResult {
  workspaceChangelog?: {
    releaseVersion: ReleaseVersion;
    contents: string;
  };
  projectChangelogs?: {
    [projectName: string]: {
      releaseVersion: ReleaseVersion;
      contents: string;
    };
  };
}

export interface ChangelogChange {
  type: string;
  scope: string;
  description: string;
  affectedProjects: string[] | '*';
  body?: string;
  isBreaking?: boolean;
  githubReferences?: Reference[];
  author?: { name: string; email: string };
  shortHash?: string;
  revertedHashes?: string[];
}

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
): Promise<NxReleaseChangelogResult> {
  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  const nxJson = readNxJson();

  if (args.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }

  // Apply default configuration to any optional user configuration
  const { error: configError, nxReleaseConfig } = await createNxReleaseConfig(
    projectGraph,
    await createProjectFileMapUsingProjectGraph(projectGraph),
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
  const rawVersionPlans = await readRawVersionPlans();
  setVersionPlansOnGroups(
    rawVersionPlans,
    releaseGroups,
    Object.keys(projectGraph.nodes)
  );

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

  const tree = new FsTree(workspaceRoot, args.verbose);

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

  let workspaceChangelogChanges: ChangelogChange[] = [];
  // TODO: remove this after the changelog renderer is refactored to remove coupling with git commits
  let workspaceChangelogCommits: GitCommit[] = [];

  // If there are multiple release groups, we'll just skip the workspace changelog anyway.
  const versionPlansEnabledForWorkspaceChangelog =
    releaseGroups[0].versionPlans;
  if (versionPlansEnabledForWorkspaceChangelog) {
    if (releaseGroups.length === 1) {
      const releaseGroup = releaseGroups[0];
      if (releaseGroup.projectsRelationship === 'fixed') {
        const versionPlans = releaseGroup.versionPlans as GroupVersionPlan[];
        workspaceChangelogChanges = filterHiddenChanges(
          versionPlans
            .map((vp) => {
              const parsedMessage = parseConventionalCommitsMessage(vp.message);

              // only properly formatted conventional commits messages will be included in the changelog
              if (!parsedMessage) {
                return null;
              }

              return <ChangelogChange>{
                type: parsedMessage.type,
                scope: parsedMessage.scope,
                description: parsedMessage.description,
                body: '',
                isBreaking: parsedMessage.breaking,
                githubReferences: [],
              };
            })
            .filter(Boolean),
          nxReleaseConfig.conventionalCommits
        );
      }
    }
  } else {
    let workspaceChangelogFromRef =
      args.from ||
      (await getLatestGitTagForPattern(nxReleaseConfig.releaseTagPattern))?.tag;
    if (!workspaceChangelogFromRef) {
      if (useAutomaticFromRef) {
        workspaceChangelogFromRef = await getFirstGitCommit();
        if (args.verbose) {
          console.log(
            `Determined workspace --from ref from the first commit in the workspace: ${workspaceChangelogFromRef}`
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

    workspaceChangelogCommits = await getCommits(
      workspaceChangelogFromSHA,
      toSHA
    );

    workspaceChangelogChanges = filterHiddenChanges(
      workspaceChangelogCommits.map((c) => {
        return {
          type: c.type,
          scope: c.scope,
          description: c.description,
          body: c.body,
          isBreaking: c.isBreaking,
          githubReferences: c.references,
          author: c.author,
          shortHash: c.shortHash,
          revertedHashes: c.revertedHashes,
          affectedProjects: '*',
        };
      }),
      nxReleaseConfig.conventionalCommits
    );
  }

  const workspaceChangelog = await generateChangelogForWorkspace({
    tree,
    args,
    projectGraph,
    nxReleaseConfig,
    workspaceChangelogVersion,
    changes: workspaceChangelogChanges,
    // TODO: remove this after the changelog renderer is refactored to remove coupling with git commits
    commits: filterHiddenCommits(
      workspaceChangelogCommits,
      nxReleaseConfig.conventionalCommits
    ),
  });

  if (
    workspaceChangelog &&
    shouldCreateGitHubRelease(
      nxReleaseConfig.changelog.workspaceChangelog,
      args.createRelease
    )
  ) {
    let hasPushed = false;

    postGitTasks.push(async (latestCommit) => {
      if (!hasPushed) {
        output.logSingleLine(`Pushing to git remote`);

        // Before we can create/update the release we need to ensure the commit exists on the remote
        await gitPush({
          gitRemote: args.gitRemote,
          dryRun: args.dryRun,
          verbose: args.verbose,
        });
        hasPushed = true;
      }

      output.logSingleLine(`Creating GitHub Release`);

      await createOrUpdateGithubRelease(
        workspaceChangelog.releaseVersion,
        workspaceChangelog.contents,
        latestCommit,
        { dryRun: args.dryRun }
      );
    });
  }

  /**
   * Compute any additional dependency bumps up front because there could be cases of circular dependencies,
   * and figuring them out during the main iteration would be too late.
   */
  const projectToAdditionalDependencyBumps = new Map<
    string,
    DependencyBump[]
  >();
  for (const releaseGroup of releaseGroups) {
    if (releaseGroup.projectsRelationship !== 'independent') {
      continue;
    }
    for (const project of releaseGroup.projects) {
      const dependentProjects = (
        projectsVersionData[project]?.dependentProjects || []
      )
        .map((dep) => {
          return {
            dependencyName: dep.source,
            newVersion: projectsVersionData[dep.source].newVersion,
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

  for (const releaseGroup of releaseGroups) {
    const config = releaseGroup.changelog;
    // The entire feature is disabled at the release group level, exit early
    if (config === false) {
      continue;
    }

    const projects = args.projects?.length
      ? // If the user has passed a list of projects, we need to use the filtered list of projects within the release group, plus any dependents
        Array.from(releaseGroupToFilteredProjects.get(releaseGroup)).flatMap(
          (project) => {
            return [
              project,
              ...(projectsVersionData[project]?.dependentProjects.map(
                (dep) => dep.source
              ) || []),
            ];
          }
        )
      : // Otherwise, we use the full list of projects within the release group
        releaseGroup.projects;
    const projectNodes = projects.map((name) => projectGraph.nodes[name]);

    if (releaseGroup.projectsRelationship === 'independent') {
      for (const project of projectNodes) {
        let changes: ChangelogChange[] | null = null;
        // TODO: remove this after the changelog renderer is refactored to remove coupling with git commits
        let commits: GitCommit[];

        if (releaseGroup.versionPlans) {
          changes = filterHiddenChanges(
            (releaseGroup.versionPlans as ProjectsVersionPlan[])
              .map((vp) => {
                const parsedMessage = parseConventionalCommitsMessage(
                  vp.message
                );

                // only properly formatted conventional commits messages will be included in the changelog
                if (!parsedMessage) {
                  return null;
                }

                return {
                  type: parsedMessage.type,
                  scope: parsedMessage.scope,
                  description: parsedMessage.description,
                  body: '',
                  isBreaking: parsedMessage.breaking,
                  affectedProjects: Object.keys(vp.projectVersionBumps),
                  githubReferences: [],
                };
              })
              .filter(Boolean),
            nxReleaseConfig.conventionalCommits
          );
        } else {
          let fromRef =
            args.from ||
            (
              await getLatestGitTagForPattern(releaseGroup.releaseTagPattern, {
                projectName: project.name,
              })
            )?.tag;

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

          const { fileMap } = await createFileMapUsingProjectGraph(
            projectGraph
          );
          const fileToProjectMap = createFileToProjectMap(
            fileMap.projectFileMap
          );

          changes = filterHiddenChanges(
            commits.map((c) => ({
              type: c.type,
              scope: c.scope,
              description: c.description,
              body: c.body,
              isBreaking: c.isBreaking,
              githubReferences: c.references,
              author: c.author,
              shortHash: c.shortHash,
              revertedHashes: c.revertedHashes,
              affectedProjects: commitChangesNonProjectFiles(
                c,
                fileMap.nonProjectFiles
              )
                ? '*'
                : getProjectsAffectedByCommit(c, fileToProjectMap),
            })),
            nxReleaseConfig.conventionalCommits
          );
        }

        const projectChangelogs = await generateChangelogForProjects({
          tree,
          args,
          projectGraph,
          changes,
          projectsVersionData,
          releaseGroup,
          projects: [project],
          nxReleaseConfig,
          projectToAdditionalDependencyBumps,
          // TODO: remove this after the changelog renderer is refactored to remove coupling with git commits
          commits: filterHiddenCommits(
            commits,
            nxReleaseConfig.conventionalCommits
          ),
        });

        let hasPushed = false;
        for (const [projectName, projectChangelog] of Object.entries(
          projectChangelogs
        )) {
          if (
            projectChangelogs &&
            shouldCreateGitHubRelease(
              releaseGroup.changelog,
              args.createRelease
            )
          ) {
            postGitTasks.push(async (latestCommit) => {
              if (!hasPushed) {
                output.logSingleLine(`Pushing to git remote`);

                // Before we can create/update the release we need to ensure the commit exists on the remote
                await gitPush({
                  gitRemote: args.gitRemote,
                  dryRun: args.dryRun,
                  verbose: args.verbose,
                });
                hasPushed = true;
              }

              output.logSingleLine(`Creating GitHub Release`);

              await createOrUpdateGithubRelease(
                projectChangelog.releaseVersion,
                projectChangelog.contents,
                latestCommit,
                { dryRun: args.dryRun }
              );
            });
          }
          allProjectChangelogs[projectName] = projectChangelog;
        }
      }
    } else {
      let changes: ChangelogChange[] = [];
      // TODO: remove this after the changelog renderer is refactored to remove coupling with git commits
      let commits: GitCommit[] = [];
      if (releaseGroup.versionPlans) {
        changes = filterHiddenChanges(
          (releaseGroup.versionPlans as GroupVersionPlan[])
            .map((vp) => {
              const parsedMessage = parseConventionalCommitsMessage(vp.message);

              // only properly formatted conventional commits messages will be included in the changelog
              if (!parsedMessage) {
                return null;
              }

              return <ChangelogChange>{
                type: parsedMessage.type,
                scope: parsedMessage.scope,
                description: parsedMessage.description,
                body: '',
                isBreaking: parsedMessage.breaking,
                githubReferences: [],
                affectedProjects: '*',
              };
            })
            .filter(Boolean),
          nxReleaseConfig.conventionalCommits
        );
      } else {
        let fromRef =
          args.from ||
          (await getLatestGitTagForPattern(releaseGroup.releaseTagPattern))
            ?.tag;
        if (!fromRef) {
          if (useAutomaticFromRef) {
            fromRef = await getFirstGitCommit();
            if (args.verbose) {
              console.log(
                `Determined release group --from ref from the first commit in the workspace: ${fromRef}`
              );
            }
          } else {
            throw new Error(
              `Unable to determine the previous git tag. If this is the first release of your release group, use the --first-release option or set the "release.changelog.automaticFromRef" config property in nx.json to generate a changelog from the first commit. Otherwise, be sure to configure the "release.releaseTagPattern" property in nx.json to match the structure of your repository's git tags.`
            );
          }
        }

        // Make sure that the fromRef is actually resolvable
        const fromSHA = await getCommitHash(fromRef);

        const { fileMap } = await createFileMapUsingProjectGraph(projectGraph);
        const fileToProjectMap = createFileToProjectMap(fileMap.projectFileMap);

        commits = await getCommits(fromSHA, toSHA);
        changes = filterHiddenChanges(
          commits.map((c) => ({
            type: c.type,
            scope: c.scope,
            description: c.description,
            body: c.body,
            isBreaking: c.isBreaking,
            githubReferences: c.references,
            author: c.author,
            shortHash: c.shortHash,
            revertedHashes: c.revertedHashes,
            affectedProjects: commitChangesNonProjectFiles(
              c,
              fileMap.nonProjectFiles
            )
              ? '*'
              : getProjectsAffectedByCommit(c, fileToProjectMap),
          })),
          nxReleaseConfig.conventionalCommits
        );
      }

      const projectChangelogs = await generateChangelogForProjects({
        tree,
        args,
        projectGraph,
        changes,
        projectsVersionData,
        releaseGroup,
        projects: projectNodes,
        nxReleaseConfig,
        projectToAdditionalDependencyBumps,
        // TODO: remove this after the changelog renderer is refactored to remove coupling with git commits
        commits: filterHiddenCommits(
          commits,
          nxReleaseConfig.conventionalCommits
        ),
      });

      let hasPushed = false;
      for (const [projectName, projectChangelog] of Object.entries(
        projectChangelogs
      )) {
        if (
          projectChangelogs &&
          shouldCreateGitHubRelease(releaseGroup.changelog, args.createRelease)
        ) {
          postGitTasks.push(async (latestCommit) => {
            if (!hasPushed) {
              output.logSingleLine(`Pushing to git remote`);

              // Before we can create/update the release we need to ensure the commit exists on the remote
              await gitPush({
                gitRemote: args.gitRemote,
                dryRun: args.dryRun,
                verbose: args.verbose,
              });
              hasPushed = true;
            }

            output.logSingleLine(`Creating GitHub Release`);

            await createOrUpdateGithubRelease(
              projectChangelog.releaseVersion,
              projectChangelog.contents,
              latestCommit,
              { dryRun: args.dryRun }
            );
          });
        }
        allProjectChangelogs[projectName] = projectChangelog;
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
    releaseGroups
  );

  return {
    workspaceChangelog,
    projectChangelogs: allProjectChangelogs,
  };
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
  gitTagValues: string[],
  releaseGroups: ReleaseGroupWithName[]
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
      // no GitHub releases to create so we can just exit
      return;
    }

    if (isCI()) {
      output.warn({
        title: `Skipped GitHub release creation because no changes were detected for any changelog files.`,
      });
      return;
    }

    // prompt the user to see if they want to create a GitHub release anyway
    // we know that the user has configured GitHub releases because we have postGitTasks
    const shouldCreateGitHubReleaseAnyway = await promptForGitHubRelease();

    if (!shouldCreateGitHubReleaseAnyway) {
      return;
    }

    for (const postGitTask of postGitTasks) {
      await postGitTask(latestCommit);
    }

    return;
  }

  const changedFiles: string[] = changes.map((f) => f.path);

  let deletedFiles: string[] = [];
  if (args.deleteVersionPlans && !args.dryRun) {
    const planFiles = new Set<string>();
    releaseGroups.forEach((group) => {
      if (group.versionPlans) {
        group.versionPlans.forEach((plan) => {
          removeSync(plan.absolutePath);
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

  // Run any post-git tasks in series
  for (const postGitTask of postGitTasks) {
    await postGitTask(latestCommit);
  }

  return;
}

async function generateChangelogForWorkspace({
  tree,
  args,
  projectGraph,
  nxReleaseConfig,
  workspaceChangelogVersion,
  changes,
  commits,
}: {
  tree: Tree;
  args: ChangelogOptions;
  projectGraph: ProjectGraph;
  nxReleaseConfig: NxReleaseConfig;
  workspaceChangelogVersion: (string | null) | undefined;
  changes: ChangelogChange[];
  commits: GitCommit[];
}): Promise<NxReleaseChangelogResult['workspaceChangelog']> {
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

  if (interpolatedTreePath) {
    const prefix = dryRun ? 'Previewing' : 'Generating';
    output.log({
      title: `${prefix} an entry in ${interpolatedTreePath} for ${chalk.white(
        releaseVersion.gitTag
      )}`,
    });
  }

  const githubRepoSlug = getGitHubRepoSlug(gitRemote);

  let contents = await changelogRenderer({
    projectGraph,
    changes,
    commits,
    releaseVersion: releaseVersion.rawVersion,
    project: null,
    repoSlug: githubRepoSlug,
    entryWhenNoChanges: config.entryWhenNoChanges,
    changelogRenderOptions: config.renderOptions,
    conventionalCommitsConfig: nxReleaseConfig.conventionalCommits,
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

    printAndFlushChanges(tree, !!dryRun, 3, false, noDiffInChangelogMessage);
  }

  return {
    releaseVersion,
    contents,
  };
}

async function generateChangelogForProjects({
  tree,
  args,
  projectGraph,
  changes,
  commits,
  projectsVersionData,
  releaseGroup,
  projects,
  nxReleaseConfig,
  projectToAdditionalDependencyBumps,
}: {
  tree: Tree;
  args: ChangelogOptions;
  projectGraph: ProjectGraph;
  changes: ChangelogChange[];
  commits: GitCommit[];
  projectsVersionData: VersionData;
  releaseGroup: ReleaseGroupWithName;
  projects: ProjectGraphProjectNode[];
  nxReleaseConfig: NxReleaseConfig;
  projectToAdditionalDependencyBumps: Map<string, DependencyBump[]>;
}): Promise<NxReleaseChangelogResult['projectChangelogs']> {
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
    if (projectsVersionData[project.name].newVersion === null) {
      continue;
    }

    const releaseVersion = new ReleaseVersion({
      version: projectsVersionData[project.name].newVersion,
      releaseTagPattern: releaseGroup.releaseTagPattern,
      projectName: project.name,
    });

    if (interpolatedTreePath) {
      const prefix = dryRun ? 'Previewing' : 'Generating';
      output.log({
        title: `${prefix} an entry in ${interpolatedTreePath} for ${chalk.white(
          releaseVersion.gitTag
        )}`,
      });
    }

    const githubRepoSlug =
      config.createRelease === 'github'
        ? getGitHubRepoSlug(gitRemote)
        : undefined;

    let contents = await changelogRenderer({
      projectGraph,
      changes,
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
      conventionalCommitsConfig: nxReleaseConfig.conventionalCommits,
      dependencyBumps: projectToAdditionalDependencyBumps.get(project.name),
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

    projectChangelogs[project.name] = {
      releaseVersion,
      contents,
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

function filterHiddenChanges(
  changes: ChangelogChange[],
  conventionalCommitsConfig: NxReleaseConfig['conventionalCommits']
): ChangelogChange[] {
  return changes.filter((change) => {
    const type = change.type;

    const typeConfig = conventionalCommitsConfig.types[type];
    if (!typeConfig) {
      // don't include changes with unknown types
      return false;
    }
    return !typeConfig.changelog.hidden;
  });
}

// TODO: remove this after the changelog renderer is refactored to remove coupling with git commits
function filterHiddenCommits(
  commits: GitCommit[],
  conventionalCommitsConfig: NxReleaseConfig['conventionalCommits']
): GitCommit[] {
  if (!commits) {
    return [];
  }
  return commits.filter((commit) => {
    const type = commit.type;

    const typeConfig = conventionalCommitsConfig.types[type];
    if (!typeConfig) {
      // don't include commits with unknown types
      return false;
    }
    return !typeConfig.changelog.hidden;
  });
}

export function shouldCreateGitHubRelease(
  changelogConfig: NxReleaseChangelogConfiguration | false | undefined,
  createReleaseArg: ChangelogOptions['createRelease'] | undefined = undefined
): boolean {
  if (createReleaseArg !== undefined) {
    return createReleaseArg === 'github';
  }

  return (changelogConfig || {}).createRelease === 'github';
}

async function promptForGitHubRelease(): Promise<boolean> {
  try {
    const result = await prompt<{ confirmation: boolean }>([
      {
        name: 'confirmation',
        message: 'Do you want to create a GitHub release anyway?',
        type: 'confirm',
      },
    ]);
    return result.confirmation;
  } catch (e) {
    // Handle the case where the user exits the prompt with ctrl+c
    return false;
  }
}

function getProjectsAffectedByCommit(
  commit: GitCommit,
  fileToProjectMap: Record<string, string>
): string[] {
  const affectedProjects = new Set<string>();
  for (const file of commit.affectedFiles) {
    affectedProjects.add(fileToProjectMap[file]);
  }
  return Array.from(affectedProjects);
}

function commitChangesNonProjectFiles(
  commit: GitCommit,
  nonProjectFiles: FileData[]
): boolean {
  return nonProjectFiles.some((fileData) =>
    commit.affectedFiles.includes(fileData.file)
  );
}

function createFileToProjectMap(
  projectFileMap: ProjectFileMap
): Record<string, string> {
  const fileToProjectMap = {};
  for (const [projectName, projectFiles] of Object.entries(projectFileMap)) {
    for (const file of projectFiles) {
      fileToProjectMap[file.file] = projectName;
    }
  }
  return fileToProjectMap;
}

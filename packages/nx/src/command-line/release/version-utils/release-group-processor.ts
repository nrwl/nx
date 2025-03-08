import { prerelease } from 'semver';
import { ProjectGraph } from '../../../config/project-graph';
import { Tree } from '../../../generators/tree';
import { output } from '../../../utils/output';
import {
  IMPLICIT_DEFAULT_RELEASE_GROUP,
  type NxReleaseConfig,
} from '../config/config';
import type { ReleaseGroupWithName } from '../config/filter-release-groups';
import { getLatestGitTagForPattern } from '../utils/git';
import { resolveSemverSpecifierFromPrompt } from '../utils/resolve-semver-specifier';
import { isRelativeVersionKeyword } from '../utils/semver';
import {
  deriveNewSemverVersion,
  ReleaseVersionGeneratorSchema,
} from '../version';
import { deriveSpecifierFromConventionalCommits } from './derive-specifier-from-conventional-commits';
import {
  deriveSpecifierFromVersionPlan,
  ManifestActions,
  resolveManifestActionsForProject,
  SemverBumpType,
} from './flexible-version-management';
import { ProjectLogger } from './project-logger';
import { resolveCurrentVersion } from './resolve-current-version';

interface GroupNode {
  group: ReleaseGroupWithName;
  dependencies: Set<string>;
  dependents: Set<string>;
}

// TODO: updateDependents of never is maybe not being intuitively. Currently the dep is bumped in the relevant manifest, it's just the version of the manifest that isn't.
// Does "never" really suggest it should be doing nothing at all to dependents? Probably... Maybe we need a third mode...

export interface VersionData {
  currentVersion: string;
  newVersion: string;
  dependentProjects: {
    source: string;
    target: string;
    type: string;
    dependencyCollection: string;
    rawVersionSpec: string;
  }[];
}

// export type VersionData = Record<
//   string,
//   {
//     /**
//      * newVersion will be null in the case that no changes are detected for the project,
//      * e.g. when using conventional commits
//      */
//     newVersion: string | null;
//     currentVersion: string;
//     /**
//      * The list of projects which depend upon the current project.
//      * TODO: investigate generic type for this once more ecosystems are explored
//      */
//     dependentProjects: any[];
//   }
// >;

// Any semver version string such as "1.2.3" or "1.2.3-beta.1"
type SemverVersion = string;

// TODO: figure out what would actually be useful here and how it should overlap with project-logger
function verboseLog(...msgs: any[]) {
  if (process.env.NX_VERBOSE_LOGGING === 'true') {
    console.log(...msgs);
  }
}

export const validReleaseVersionPrefixes = ['auto', '', '~', '^', '='] as const;

const BUMP_TYPE_REASON_TEXT = {
  DEPENDENCY_WAS_BUMPED: ', because a dependency was bumped, ',
  USER_SPECIFIER: ', from the given specifier, ',
  PROMPTED_USER_SPECIFIER: ', from the prompted specifier, ',
  CONVENTIONAL_COMMITS: ', derived from conventional commits data, ',
  DEPENDENCY_ACROSS_GROUPS_WAS_BUMPED:
    ', because a dependency project belonging to another release group was bumped, ',
  OTHER_PROJECT_IN_FIXED_GROUP_WAS_BUMPED_DUE_TO_DEPENDENCY:
    ', because of a dependency-only bump to another project in the same fixed release group, ',
} as const;

// TODO: Can we make the implementation more efficient if we sort the projects from the projectGraph topologically upfront?

export class ReleaseGroupProcessor {
  private groupGraph: Map<string, GroupNode> = new Map();
  private processedGroups: Set<string> = new Set();
  private bumpedProjects: Set<string> = new Set();
  /**
   * Track the unique manifest actions involved in the current versioning process so that we can
   * reliably invoke certain static lifecycle methods once per manifest actions type, rather than
   * simply once per project.
   */
  private uniqueManifestActions: Map<string, typeof ManifestActions> =
    new Map();
  /**
   * Track the manifest actions for each project so that we can invoke certain instance methods.
   */
  private projectsToManifestActions: Map<string, ManifestActions> = new Map();
  private updateDependents: 'auto' | 'never';
  private versionData: Map<string, VersionData> = new Map();
  private projectsToProcess: Set<string>;
  private allProjectsToProcess: Set<string>;
  private userGivenSpecifier: string | undefined;
  private cachedCurrentVersions: Map<string, string> = new Map();
  private cachedLatestMatchingGitTag: Map<
    string,
    Awaited<ReturnType<typeof getLatestGitTagForPattern>>
  > = new Map();
  /**
   * In the case of fixed release groups that are configured to resolve the current version from a registry
   * or a git tag, it would be a waste of time and resources to resolve the current version for each individual
   * project, therefore we maintain a cache of the current version for each applicable fixed release group here.
   */
  private cachedCurrentVersionsPerFixedReleaseGroup: Map<
    string, // release group name
    {
      currentVersion: string;
      originatingProjectName: string;
      logText: string;
    }
  > = new Map();
  private projectLoggers: Map<string, ProjectLogger> = new Map();

  constructor(
    private tree: Tree,
    private projectGraph: ProjectGraph,
    private nxReleaseConfig: NxReleaseConfig,
    private releaseGroups: ReleaseGroupWithName[],
    private dryRun: boolean,
    private verbose: boolean,
    private firstRelease: boolean,
    private preid: string,
    userGivenSpecifier?: SemverBumpType,
    projectsToProcess?: string[]
  ) {
    // Strip any leading "v" from the user given specifier, if it exists
    this.userGivenSpecifier = userGivenSpecifier?.replace(/^v/, '');

    this.updateDependents =
      (this.nxReleaseConfig.version?.generatorOptions?.updateDependents as
        | 'auto'
        | 'never') || 'auto';
    this.projectsToProcess = new Set(
      projectsToProcess || Object.keys(this.projectGraph.nodes)
    );

    this.allProjectsToProcess = new Set(this.projectsToProcess);
    if (this.updateDependents === 'auto') {
      const projectsToProcess = Array.from(this.projectsToProcess);
      let dependents = this.getAllDependents(projectsToProcess);
      while (dependents.length > 0) {
        dependents.forEach((dep) => this.allProjectsToProcess.add(dep));
        dependents = this.getAllDependents(dependents);
      }
    }
  }

  private getAllDependents(projects: string[]): string[] {
    return projects
      .flatMap((project) => this.getDependentsForProject(project))
      .filter((dep) => !this.allProjectsToProcess.has(dep));
  }

  private getDependentsForProject(project: string): string[] {
    return Object.entries(this.projectGraph.dependencies)
      .filter(([_, deps]) => deps.some((dep) => dep.target === project))
      .map(([projectName]) => projectName);
  }

  async buildGroupGraph(): Promise<void> {
    try {
      // Initialize group nodes
      for (const group of this.releaseGroups) {
        this.groupGraph.set(group.name, {
          group,
          dependencies: new Set(),
          dependents: new Set(),
        });
      }

      // Build dependencies and dependents between groups
      for (const [releaseGroupName, releaseGroupNode] of this.groupGraph) {
        for (const projectName of releaseGroupNode.group.projects) {
          // Resolve the appropriate ManifestActions instance for the project
          if (!this.projectsToManifestActions.has(projectName)) {
            // TODO: Surely this validation should move to the manifest actions???
            if (
              releaseGroupNode.group.version?.generatorOptions?.versionPrefix &&
              !validReleaseVersionPrefixes.includes(
                releaseGroupNode.group.version?.generatorOptions
                  ?.versionPrefix as any
              )
            ) {
              throw new Error(
                `Invalid value for version.generatorOptions.versionPrefix: "${
                  releaseGroupNode.group.version?.generatorOptions
                    ?.versionPrefix
                }"

Valid values are: ${validReleaseVersionPrefixes
                  .map((s) => `"${s}"`)
                  .join(', ')}`
              );
            }

            const projectGraphNode = this.projectGraph.nodes[projectName];

            const {
              manifestActionsPath,
              ManifestActionsClass,
              manifestActions,
            } = await resolveManifestActionsForProject(
              this.tree,
              releaseGroupNode.group,
              projectGraphNode
            );
            if (!this.uniqueManifestActions.has(manifestActionsPath)) {
              this.uniqueManifestActions.set(
                manifestActionsPath,
                ManifestActionsClass
              );
            }
            this.projectsToManifestActions.set(projectName, manifestActions);

            // Create a reusable project logger to use for the full lifecycle of the versioning process
            const projectLogger = new ProjectLogger(projectName);
            this.projectLoggers.set(projectName, projectLogger);

            let latestMatchingGitTag:
              | Awaited<ReturnType<typeof getLatestGitTagForPattern>>
              | undefined;
            const releaseTagPattern = releaseGroupNode.group.releaseTagPattern;
            // Cache the last matching git tag for relevant projects
            if (
              releaseGroupNode.group.version.generatorOptions
                .currentVersionResolver === 'git-tag'
            ) {
              latestMatchingGitTag = await getLatestGitTagForPattern(
                releaseTagPattern,
                {
                  projectName: projectGraphNode.name,
                }
              );
              this.cachedLatestMatchingGitTag.set(
                projectName,
                latestMatchingGitTag
              );
            }

            let specifierSource: ReleaseVersionGeneratorSchema['specifierSource'] =
              'prompt';
            // The user is forcibly overriding whatever specifierSource they had otherwise set by imperatively providing a specifier
            if (this.userGivenSpecifier) {
              specifierSource = 'prompt';
            } else if (
              releaseGroupNode.group.version.generatorOptions.specifierSource
            ) {
              specifierSource = releaseGroupNode.group.version.generatorOptions
                .specifierSource as ReleaseVersionGeneratorSchema['specifierSource'];
            }

            // Cache the current version for the project
            const currentVersion = await resolveCurrentVersion(
              this.tree,
              projectGraphNode,
              releaseGroupNode.group,
              manifestActions,
              projectLogger,
              this.firstRelease,
              this.cachedCurrentVersionsPerFixedReleaseGroup,
              specifierSource,
              releaseTagPattern,
              latestMatchingGitTag
            );
            this.cachedCurrentVersions.set(projectName, currentVersion);
          }

          // Process project dependencies
          const projectDeps = this.projectGraph.dependencies[projectName] || [];
          for (const dep of projectDeps) {
            const dependencyGroup = this.findGroupForProject(dep.target);
            if (dependencyGroup && dependencyGroup !== releaseGroupName) {
              releaseGroupNode.dependencies.add(dependencyGroup);
              this.groupGraph
                .get(dependencyGroup)!
                .dependents.add(releaseGroupName);
            }
          }
        }
      }

      // Filter projects in each group based on projectsToProcess
      for (const [groupName, groupNode] of this.groupGraph) {
        groupNode.group.projects = groupNode.group.projects.filter((project) =>
          this.projectsToProcess.has(project)
        );
      }
    } catch (e) {
      if (this.verbose) {
        output.error({
          title: e.message,
        });
        // Dump the full stack trace in verbose mode
        console.error(e);
      } else {
        output.error({
          title: e.message,
        });
      }
      process.exit(1);
    }
  }

  findGroupForProject(projectName: string): string | null {
    for (const [releaseGroupName, releaseGroupNode] of this.groupGraph) {
      if (releaseGroupNode.group.projects.includes(projectName)) {
        return releaseGroupName;
      }
    }
    return null;
  }

  getNextGroup(): string | null {
    for (const [groupName, groupNode] of this.groupGraph) {
      if (
        !this.processedGroups.has(groupName) &&
        Array.from(groupNode.dependencies).every((dep) =>
          this.processedGroups.has(dep)
        )
      ) {
        return groupName;
      }
    }
    return null;
  }

  async processGroups(): Promise<string[]> {
    const processOrder: string[] = [];
    let nextGroup: string | null;
    while ((nextGroup = this.getNextGroup()) !== null) {
      await this.processGroup(nextGroup);
      this.processedGroups.add(nextGroup);
      processOrder.push(nextGroup);
    }
    return processOrder;
  }

  /**
   * Invoke the static afterAllProjectsVersioned method for each unique manifest actions type.
   * This can be useful for performing actions like updating a workspace level lock file.
   *
   * Because the tree has already been flushed to disk at this point, each afterAllProjectsVersioned
   * callback is responsible for returning the list of changed and deleted files that it affected.
   */
  async afterAllProjectsVersioned(
    generatorOptions: Record<string, unknown>
  ): Promise<{
    changedFiles: string[];
    deletedFiles: string[];
  }> {
    const changedFiles = new Set<string>();
    const deletedFiles = new Set<string>();

    for (const [, ManifestActionsClass] of this.uniqueManifestActions) {
      if (ManifestActionsClass.createAfterAllProjectsVersionedCallback) {
        const afterAllProjectsVersioned =
          ManifestActionsClass.createAfterAllProjectsVersionedCallback(
            this.tree.root,
            {
              dryRun: this.dryRun,
              verbose: this.verbose,
              generatorOptions,
            }
          );
        const {
          changedFiles: changedFilesForManifestActions,
          deletedFiles: deletedFilesForManifestActions,
        } = await afterAllProjectsVersioned();
        for (const file of changedFilesForManifestActions) {
          changedFiles.add(file);
        }
        for (const file of deletedFilesForManifestActions) {
          deletedFiles.add(file);
        }
      }
    }

    return {
      changedFiles: Array.from(changedFiles),
      deletedFiles: Array.from(deletedFiles),
    };
  }

  private async processGroup(releaseGroupName: string): Promise<void> {
    const groupNode = this.groupGraph.get(releaseGroupName)!;
    const bumped = await this.bumpVersions(groupNode.group);

    // Flush the project loggers for the group
    for (const project of groupNode.group.projects) {
      const projectLogger = this.getProjectLoggerForProject(project);
      projectLogger.flush();
    }

    if (bumped) {
      await this.propagateChangesToDependentGroups(releaseGroupName);
    }
  }

  private async propagateChangesToDependentGroups(
    changedReleaseGroupName: string
  ): Promise<void> {
    const changedGroupNode = this.groupGraph.get(changedReleaseGroupName)!;
    for (const depGroupName of changedGroupNode.dependents) {
      if (!this.processedGroups.has(depGroupName)) {
        await this.propagateChanges(depGroupName, changedReleaseGroupName);
      }
    }
  }

  private async bumpVersions(
    releaseGroup: ReleaseGroupWithName
  ): Promise<boolean> {
    if (releaseGroup.projectsRelationship === 'fixed') {
      return this.bumpFixedVersionGroup(releaseGroup);
    } else {
      return this.bumpIndependentVersionGroup(releaseGroup);
    }
  }

  private async bumpFixedVersionGroup(
    releaseGroup: ReleaseGroupWithName
  ): Promise<boolean> {
    if (releaseGroup.projects.length === 0) {
      return false;
    }

    let bumped = false;

    const firstProject = releaseGroup.projects[0];
    const { bumpType, bumpTypeReason } =
      await this.determineVersionBumpForProject(releaseGroup, firstProject);

    if (bumpType === 'none') {
      // No direct bump for this group, but we may still need to bump if a dependency group has been bumped
      let bumpedByDependency = false;

      // Iterate through each project in the release group
      for (const project of releaseGroup.projects) {
        const dependencies = this.projectGraph.dependencies[project] || [];
        for (const dep of dependencies) {
          const depGroup = this.findGroupForProject(dep.target);
          if (
            depGroup &&
            depGroup !== releaseGroup.name &&
            this.processedGroups.has(depGroup)
          ) {
            const depGroupBumpType = await this.getGroupBumpType(depGroup);

            // If a dependency group has been bumped, determine if it should trigger a bump in this group
            if (depGroupBumpType !== 'none') {
              bumpedByDependency = true;
              verboseLog(
                `Bumping project ${project} due to dependency group ${depGroup} being bumped.`
              );
              const depBumpType = this.determineSideEffectBump(
                releaseGroup,
                depGroupBumpType as SemverBumpType
              );
              await this.bumpVersionForProject(
                project,
                depBumpType,
                'DEPENDENCY_ACROSS_GROUPS_WAS_BUMPED'
              );
              this.bumpedProjects.add(project);

              // Update any dependencies in the manifest
              await this.updateDependenciesForProject(project);
            }
          }
        }
      }

      // If any project in the group was bumped due to dependency changes, we must bump all projects in the fixed group
      if (bumpedByDependency) {
        for (const project of releaseGroup.projects) {
          if (!this.bumpedProjects.has(project)) {
            await this.bumpVersionForProject(
              project,
              'patch',
              'OTHER_PROJECT_IN_FIXED_GROUP_WAS_BUMPED_DUE_TO_DEPENDENCY'
            );
            // Ensure the bump for remaining projects
            this.bumpedProjects.add(project);
            await this.updateDependenciesForProject(project);
          }
        }
      } else {
        /**
         * No projects in the group are being bumped, but as it stands only the first project would have an appropriate log,
         * therefore add in an extra log for each additional project in the group, and we also need to make sure that the
         * versionData is fully populated.
         */
        for (const project of releaseGroup.projects) {
          this.versionData.set(project, {
            currentVersion: this.getCurrentCachedVersionForProject(project),
            newVersion: null,
            // TODO: cache project => dependent projects lookup, it's repeated multiple times and involves disk IO
            dependentProjects: await this.getDependentProjects(project),
          });
          if (project === firstProject) {
            continue;
          }
          const projectLogger = this.getProjectLoggerForProject(project);
          projectLogger.buffer(
            `🚫 Skipping versioning for ${project} as it is a part of a fixed release group with ${firstProject} and no dependency bumps were detected`
          );
        }
      }

      return bumpedByDependency;
    }

    const { newVersion } = await this.calculateNewVersion(
      firstProject,
      bumpType,
      bumpTypeReason
    );

    // First, update versions for all projects in the fixed group
    for (let i = 0; i < releaseGroup.projects.length; i++) {
      const project = releaseGroup.projects[i];
      const manifestActions = this.getManifestActionsForProject(project);
      const projectLogger = this.getProjectLoggerForProject(project);

      try {
        const currentVersion = this.getCurrentCachedVersionForProject(project);

        // The first project's version was determined above, so this log is only appropriate for the remaining projects
        if (i > 0) {
          projectLogger.buffer(
            `❓ Applied version ${newVersion} directly, because the project is a member of a fixed release group containing ${firstProject}`
          );
        }

        // Write the new version to the manifest
        await manifestActions.writeVersionToManifest(this.tree, newVersion);
        projectLogger.buffer(
          `✍️  New version ${newVersion} written to manifest: ${manifestActions.getPrimaryManifestPath()}`
        );
        this.bumpedProjects.add(project);
        bumped = true;

        // Populate version data for each project
        this.versionData.set(project, {
          currentVersion,
          newVersion,
          dependentProjects: await this.getDependentProjects(project),
        });
      } catch (error) {
        console.error(`Error processing project: ${project}`);
        throw error;
      }
    }

    // Then, update dependencies for all projects in the fixed group
    if (bumped) {
      for (const project of releaseGroup.projects) {
        await this.updateDependenciesForProject(project);
      }
    }

    return bumped;
  }

  private async bumpIndependentVersionGroup(
    releaseGroup: ReleaseGroupWithName
  ): Promise<boolean> {
    verboseLog('Starting bumpIndependentVersionGroup');
    verboseLog('Projects in release group:', releaseGroup.projects);
    verboseLog(
      'All projects to process:',
      Array.from(this.allProjectsToProcess)
    );
    verboseLog('updateDependents setting:', this.updateDependents);

    let bumped = false;
    const projectBumpTypes = new Map<
      string,
      {
        bumpType: SemverBumpType | SemverVersion;
        bumpTypeReason: keyof typeof BUMP_TYPE_REASON_TEXT | 'UNHANDLED';
      }
    >();
    const projectsToUpdate = new Set<string>();

    // First pass: Determine bump types
    for (const project of this.allProjectsToProcess) {
      const { bumpType, bumpTypeReason } =
        await this.determineVersionBumpForProject(releaseGroup, project);
      verboseLog(
        `First pass - Project: ${project}, Bump type: ${bumpType}, Bump type reason: ${bumpTypeReason}`
      );
      projectBumpTypes.set(project, { bumpType, bumpTypeReason });
      if (bumpType !== 'none') {
        projectsToUpdate.add(project);
      }
    }

    verboseLog(
      'After first pass - Projects to update:',
      Array.from(projectsToUpdate)
    );

    // Second pass: Update versions
    for (const project of releaseGroup.projects) {
      if (projectsToUpdate.has(project)) {
        const { bumpType: finalBumpType, bumpTypeReason: finalBumpTypeReason } =
          projectBumpTypes.get(project)!;
        verboseLog(
          `Second pass - Project: ${project}, Final bump type: ${finalBumpType}, Bump type reason: ${finalBumpTypeReason}`
        );
        if (finalBumpType !== 'none') {
          await this.bumpVersionForProject(
            project,
            finalBumpType,
            finalBumpTypeReason
          );
          this.bumpedProjects.add(project);
          bumped = true;
        }
      }
    }

    // Third pass: Update dependencies
    for (const project of releaseGroup.projects) {
      if (projectsToUpdate.has(project)) {
        await this.updateDependenciesForProject(project);
      }
    }

    verboseLog('Bumped projects:', Array.from(this.bumpedProjects));
    return bumped;
  }

  private async determineVersionBumpForProject(
    releaseGroup: ReleaseGroupWithName,
    projectName: string
  ): Promise<{
    bumpType: SemverBumpType | SemverVersion;
    bumpTypeReason: keyof typeof BUMP_TYPE_REASON_TEXT | 'UNHANDLED';
  }> {
    // User given specifier has the highest precedence
    if (this.userGivenSpecifier) {
      return {
        bumpType: this.userGivenSpecifier as SemverBumpType,
        bumpTypeReason: 'USER_SPECIFIER',
      };
    }

    // Resolve the semver relative bump via conventional-commits
    if (
      releaseGroup.version.generatorOptions.specifierSource ===
      'conventional-commits'
    ) {
      const currentVersion =
        this.getCurrentCachedVersionForProject(projectName);
      const projectLogger = this.getProjectLoggerForProject(projectName);
      const bumpType = await deriveSpecifierFromConventionalCommits(
        this.nxReleaseConfig,
        this.projectGraph,
        projectLogger,
        releaseGroup,
        this.projectGraph.nodes[projectName],
        !!prerelease(currentVersion ?? ''),
        this.cachedLatestMatchingGitTag.get(projectName),
        this.preid
      );
      return {
        bumpType,
        bumpTypeReason: 'CONVENTIONAL_COMMITS',
      };
    }

    // Resolve the semver relative bump via version-plans
    if (releaseGroup.versionPlans) {
      const bumpType = await deriveSpecifierFromVersionPlan(projectName);
      return {
        bumpType,
        bumpTypeReason: 'UNHANDLEDGGGGG' as any,
      };
    }

    // Only add the release group name to the log if it is one set by the user, otherwise it is useless noise
    const maybeLogReleaseGroup = (log: string): string => {
      if (releaseGroup.name === IMPLICIT_DEFAULT_RELEASE_GROUP) {
        return log;
      }
      return `${log} within release group "${releaseGroup.name}"`;
    };
    if (releaseGroup.version.generatorOptions.specifierSource === 'prompt') {
      let specifier: SemverBumpType | SemverVersion;
      if (releaseGroup.projectsRelationship === 'independent') {
        specifier = await resolveSemverSpecifierFromPrompt(
          `${maybeLogReleaseGroup(
            `What kind of change is this for project "${projectName}"`
          )}?`,
          `${maybeLogReleaseGroup(
            `What is the exact version for project "${projectName}"`
          )}?`
        );
      } else {
        specifier = await resolveSemverSpecifierFromPrompt(
          `${maybeLogReleaseGroup(
            `What kind of change is this for the ${releaseGroup.projects.length} matched projects(s)`
          )}?`,
          `${maybeLogReleaseGroup(
            `What is the exact version for the ${releaseGroup.projects.length} matched project(s)`
          )}?`
        );
      }
      return {
        bumpType: specifier,
        bumpTypeReason: 'PROMPTED_USER_SPECIFIER',
      };
    }

    throw new Error(`Unhandled version bump config`);
  }

  private getManifestActionsForProject(projectName: string): ManifestActions {
    const manifestActions = this.projectsToManifestActions.get(projectName);
    if (!manifestActions) {
      throw new Error(
        `No manifest actions found for project ${projectName}, please report this as a bug on https://github.com/nrwl/nx/issues`
      );
    }
    return manifestActions;
  }

  private getProjectLoggerForProject(projectName: string): ProjectLogger {
    const projectLogger = this.projectLoggers.get(projectName);
    if (!projectLogger) {
      throw new Error(
        `No project logger found for project ${projectName}, please report this as a bug on https://github.com/nrwl/nx/issues`
      );
    }
    return projectLogger;
  }

  private getCurrentCachedVersionForProject(projectName: string): string {
    const currentVersion = this.cachedCurrentVersions.get(projectName);
    if (!currentVersion) {
      throw new Error(
        `Unexpected error: No cached current version found for project ${projectName}, please report this as a bug on https://github.com/nrwl/nx/issues`
      );
    }
    return currentVersion;
  }

  private async calculateNewVersion(
    project: string,
    bumpType: SemverBumpType | SemverVersion,
    bumpTypeReason: keyof typeof BUMP_TYPE_REASON_TEXT | 'UNHANDLED'
  ): Promise<{ currentVersion: string; newVersion: string }> {
    const currentVersion = this.getCurrentCachedVersionForProject(project);
    const projectLogger = this.getProjectLoggerForProject(project);
    const newVersion = deriveNewSemverVersion(
      currentVersion,
      bumpType,
      this.preid
    );
    const bumpTypeReasonText = BUMP_TYPE_REASON_TEXT[bumpTypeReason];
    if (!bumpTypeReasonText) {
      throw new Error(
        `Unhandled bump type reason for ${project} with bump type ${bumpType} and bump type reason ${bumpTypeReason}`
      );
    }
    const bumpText = isRelativeVersionKeyword(bumpType)
      ? `semver relative bump "${bumpType}"`
      : `explicit semver value "${bumpType}"`;
    projectLogger.buffer(
      `❓ Applied ${bumpText}${bumpTypeReasonText}to get new version ${newVersion}`
    );
    return { currentVersion, newVersion };
  }

  // TODO: set valid values for versionPrefix somewhere
  // export const validReleaseVersionPrefixes = ['auto', '', '~', '^', '='] as const;
  // TODO: should prefix handling actually move to the manifest actions? Some prefixes are likely ecosystem specific
  private async updateDependenciesForProject(
    projectName: string
  ): Promise<void> {
    verboseLog(`Updating dependencies for project: ${projectName}`);

    if (!this.allProjectsToProcess.has(projectName)) {
      throw new Error(
        `Unable to find ${projectName} in allProjectsToProcess, please report this as a bug on https://github.com/nrwl/nx/issues`
      );
    }

    const manifestActions = this.getManifestActionsForProject(projectName);

    const dependenciesToUpdate: Record<string, string> = {};
    const dependencies = this.projectGraph.dependencies[projectName] || [];

    // Get the versionPrefix from generatorOptions, defaulting to 'auto'
    // TODO: Make this config come from the release group instead, and set it on the manifest actions when instantiating it
    const versionPrefix = (this.nxReleaseConfig.version?.generatorOptions
      ?.versionPrefix ?? 'auto') as 'auto' | '~' | '^' | '=';
    if (versionPrefix !== 'auto') {
      verboseLog(`Version prefix: ${versionPrefix}`);
    }

    for (const dep of dependencies) {
      if (
        this.allProjectsToProcess.has(dep.target) &&
        this.bumpedProjects.has(dep.target)
      ) {
        const targetVersionData = this.versionData.get(dep.target);
        if (targetVersionData) {
          const { currentVersion: currentDependencyVersion } =
            await manifestActions.getCurrentVersionOfDependency(
              this.tree,
              this.projectGraph,
              dep.target
            );

          let finalPrefix = '';
          if (versionPrefix === 'auto') {
            const prefixMatch = currentDependencyVersion?.match(/^([~^=])/);
            finalPrefix = prefixMatch ? prefixMatch[1] : '';
          } else if (['~', '^', '='].includes(versionPrefix)) {
            finalPrefix = versionPrefix;
          }

          if (finalPrefix !== '') {
            verboseLog(`Final prefix: ${finalPrefix}`);
          }

          // Remove any existing prefix from the new version before applying the finalPrefix
          const cleanNewVersion = targetVersionData.newVersion.replace(
            /^[~^=]/,
            ''
          );
          dependenciesToUpdate[dep.target] = `${finalPrefix}${cleanNewVersion}`;
        }
      }
    }

    if (Object.keys(dependenciesToUpdate).length > 0) {
      verboseLog(
        `Updating dependencies for ${projectName}:`,
        dependenciesToUpdate
      );
      await manifestActions.updateDependencies(
        this.tree,
        this.projectGraph,
        dependenciesToUpdate
      );
    }
  }

  private async bumpVersionForProject(
    projectName: string,
    bumpType: SemverBumpType | SemverVersion,
    bumpTypeReason: keyof typeof BUMP_TYPE_REASON_TEXT | 'UNHANDLED'
  ): Promise<void> {
    if (bumpTypeReason === 'UNHANDLED') {
      throw new Error(
        `Unhandled bump type reason for ${projectName} with bump type ${bumpType}`
      );
    }

    const projectLogger = this.getProjectLoggerForProject(projectName);

    if (bumpType === 'none') {
      projectLogger.buffer(
        `⏩ Skipping bump for ${projectName} as bump type is "none"`
      );
      return;
    }

    const manifestActions = this.getManifestActionsForProject(projectName);

    const { currentVersion, newVersion } = await this.calculateNewVersion(
      projectName,
      bumpType,
      bumpTypeReason
    );

    // Write the new version to the manifest
    await manifestActions.writeVersionToManifest(this.tree, newVersion);
    projectLogger.buffer(
      `✍️  New version ${newVersion} written to manifest: ${manifestActions.getPrimaryManifestPath()}`
    );

    // Update version data and bumped projects
    this.versionData.set(projectName, {
      currentVersion,
      newVersion,
      dependentProjects: await this.getDependentProjects(projectName),
    });
    this.bumpedProjects.add(projectName);

    // Only update dependencies if updateDependents is 'auto'
    if (this.updateDependents === 'auto') {
      const dependents = this.getDependentsForProject(projectName);
      await this.updateDependenciesForDependents(dependents);

      for (const dependent of dependents) {
        if (
          this.allProjectsToProcess.has(dependent) &&
          !this.bumpedProjects.has(dependent)
        ) {
          await this.bumpVersionForProject(
            dependent,
            'patch',
            'DEPENDENCY_WAS_BUMPED'
          );
        }
      }

      const totalDependents = dependents.length;
      if (totalDependents > 0) {
        const depText = totalDependents === 1 ? 'project' : 'projects';
        projectLogger.buffer(
          `⏫ Updated dependency on ${projectName} and applied "patch" bump for ${totalDependents} ${depText}`
        );
      }
    } else {
      projectLogger.buffer(
        `⏩ Skipping dependent updates as "updateDependents" is not "auto"`
      );
    }
  }

  private async updateDependenciesForDependents(
    dependents: string[]
  ): Promise<void> {
    for (const dependent of dependents) {
      if (!this.allProjectsToProcess.has(dependent)) {
        throw new Error(
          `Unable to find ${dependent} in allProjectsToProcess, please report this as a bug on https://github.com/nrwl/nx/issues`
        );
      }
      await this.updateDependenciesForProject(dependent);
    }
  }

  public getVersionData(): Record<string, VersionData> {
    return Object.fromEntries(this.versionData);
  }

  private async getDependentProjects(
    project: string
  ): Promise<VersionData['dependentProjects']> {
    const dependents: VersionData['dependentProjects'] = [];
    const dependencies = this.projectGraph.dependencies || {};

    for (const [source, deps] of Object.entries(dependencies)) {
      if (!Array.isArray(deps)) continue;

      for (const dep of deps) {
        if (dep && dep.target === project) {
          const manifestActions = this.getManifestActionsForProject(source);
          try {
            const manifestData = await manifestActions.getInitialManifestData(
              this.tree
            );
            if (manifestData && manifestData.dependencies) {
              const dependencyCollection =
                Object.keys(manifestData.dependencies).find(
                  (key) =>
                    manifestData.dependencies[key] &&
                    manifestData.dependencies[key][project]
                ) || 'dependencies';
              const rawVersionSpec =
                manifestData.dependencies[dependencyCollection]?.[project] ||
                '';

              dependents.push({
                source,
                target: project,
                type: 'static',
                dependencyCollection,
                rawVersionSpec,
              });
            }
          } catch (error) {
            console.error(
              `Error processing manifest for project ${source}:`,
              error
            );
          }
        }
      }
    }
    return dependents;
  }

  async propagateChanges(
    releaseGroupName: string,
    changedDependencyGroup: string
  ): Promise<void> {
    const releaseGroup = this.groupGraph.get(releaseGroupName)!.group;

    let groupBumped = false;
    let bumpType: SemverBumpType = 'none';

    verboseLog(`Processing group: ${releaseGroupName}`);
    verboseLog(
      `Checking if group depends on changed group: ${changedDependencyGroup}`
    );

    if (releaseGroup.projectsRelationship === 'fixed') {
      // For fixed groups, we only need to check one project
      const project = releaseGroup.projects[0];
      const dependencies = this.projectGraph.dependencies[project] || [];
      const hasDependencyInChangedGroup = dependencies.some(
        (dep) => this.findGroupForProject(dep.target) === changedDependencyGroup
      );

      verboseLog(`Fixed group dependencies: ${JSON.stringify(dependencies)}`);

      if (hasDependencyInChangedGroup) {
        const dependencyBumpType = await this.getGroupBumpType(
          changedDependencyGroup
        );
        verboseLog(
          `Dependency bump type for group ${changedDependencyGroup}: ${dependencyBumpType}`
        );

        bumpType = this.determineSideEffectBump(
          releaseGroup,
          dependencyBumpType as SemverBumpType
        );
        groupBumped = bumpType !== 'none';
      }
    } else {
      // For independent groups, we need to check each project individually
      for (const project of releaseGroup.projects) {
        const dependencies = this.projectGraph.dependencies[project] || [];
        const hasDependencyInChangedGroup = dependencies.some(
          (dep) =>
            this.findGroupForProject(dep.target) === changedDependencyGroup
        );

        verboseLog(
          `Project ${project} dependencies: ${JSON.stringify(dependencies)}`
        );

        if (hasDependencyInChangedGroup) {
          const dependencyBumpType = await this.getGroupBumpType(
            changedDependencyGroup
          );
          verboseLog(
            `Dependency bump type for project ${project}: ${dependencyBumpType}`
          );

          const projectBumpType = this.determineSideEffectBump(
            releaseGroup,
            dependencyBumpType as SemverBumpType
          );
          if (projectBumpType !== 'none') {
            groupBumped = true;
            if (!this.bumpedProjects.has(project)) {
              await this.bumpVersionForProject(
                project,
                projectBumpType,
                'UNHANDLEDGG(GIG((' as any
              );
              this.bumpedProjects.add(project);
              verboseLog(`Bumped version for project ${project}`);
            }
          }
        }
      }
    }

    if (groupBumped) {
      verboseLog(
        `Group ${releaseGroupName} was bumped due to dependencies in group ${changedDependencyGroup}`
      );
      for (const project of releaseGroup.projects) {
        if (!this.bumpedProjects.has(project)) {
          await this.bumpVersionForProject(
            project,
            bumpType,
            'DEPENDENCY_ACROSS_GROUPS_WAS_BUMPED'
          );
          this.bumpedProjects.add(project);
        }
      }
    }
  }

  private async getGroupBumpType(
    releaseGroupName: string
  ): Promise<SemverBumpType | SemverVersion> {
    const releaseGroup = this.groupGraph.get(releaseGroupName)!.group;
    const { bumpType } = await this.determineVersionBumpForProject(
      releaseGroup,
      releaseGroup.projects[0]
    );
    return bumpType;
  }

  private determineSideEffectBump(
    releaseGroup: ReleaseGroupWithName,
    dependencyBumpType: SemverBumpType
  ): SemverBumpType {
    // TODO: figure out sideEffectBump
    const sideEffectBump =
      releaseGroup.version.generatorOptions?.sideEffectBump || 'patch';
    if (sideEffectBump === 'same-as-dependency') {
      return dependencyBumpType;
    }
    return sideEffectBump as SemverBumpType;
  }
}

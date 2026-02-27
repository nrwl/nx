import * as semver from 'semver';
import { NxReleaseVersionConfiguration } from '../../../config/nx-json';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import { Tree } from '../../../generators/tree';
import { workspaceRoot } from '../../../utils/workspace-root';
import {
  IMPLICIT_DEFAULT_RELEASE_GROUP,
  type NxReleaseConfig,
} from '../config/config';
import type { ReleaseGroupWithName } from '../config/filter-release-groups';
import { FinalConfigForProject, ReleaseGraph } from '../utils/release-graph';
import { resolveSemverSpecifierFromPrompt } from '../utils/resolve-semver-specifier';
import type { VersionData, VersionDataEntry } from '../utils/shared';
import { deriveSpecifierFromConventionalCommits } from './derive-specifier-from-conventional-commits';
import { deriveSpecifierFromVersionPlan } from './deriver-specifier-from-version-plans';
import { ProjectLogger } from './project-logger';
import {
  NOOP_VERSION_ACTIONS,
  SemverBumpType,
  VersionActions,
} from './version-actions';

// Any semver version string such as "1.2.3" or "1.2.3-beta.1"
type SemverVersion = string;

export const BUMP_TYPE_REASON_TEXT = {
  DEPENDENCY_WAS_BUMPED: ', because a dependency was bumped, ',
  USER_SPECIFIER: ', from the given specifier, ',
  PROMPTED_USER_SPECIFIER: ', from the prompted specifier, ',
  CONVENTIONAL_COMMITS: ', derived from conventional commits data, ',
  VERSION_PLANS: ', read from version plan {versionPlanPath}, ',
  DEPENDENCY_ACROSS_GROUPS_WAS_BUMPED:
    ', because a dependency project belonging to another release group was bumped, ',
  OTHER_PROJECT_IN_FIXED_GROUP_WAS_BUMPED_DUE_TO_DEPENDENCY:
    ', because of a dependency-only bump to another project in the same fixed release group, ',
  NOOP_VERSION_ACTIONS:
    ', because this project uses docker and has been configured to skip VersionActions, ',
} as const;

interface ReleaseGroupProcessorOptions {
  dryRun: boolean;
  verbose: boolean;
  firstRelease: boolean;
  preid: string;
  // This could be a semver bump type, an exact semver version, or any arbitrary string to use as a new version
  userGivenSpecifier?: string;
  projectsToProcess?: string[];
  /**
   * The optional results of applying the --project or --group filters.
   * These will be empty if there is no filtering, or contain the subset of projects or groups that
   * are being versioned if one of the (mutually exclusive) filters is set.
   */
  filters: {
    projects?: string[];
    groups?: string[];
  };
  // Optional overrides that may be passed in from the programmatic API
  versionActionsOptionsOverrides?: Record<string, unknown>;
}

export class ReleaseGroupProcessor {
  /**
   * Tracks which release groups have already been processed to avoid
   * processing them multiple times. Used during the group traversal.
   */
  private processedGroups: Set<string> = new Set();

  /**
   * Keeps track of which projects have already had their versions bumped.
   * This is used to avoid redundant version bumping and to determine which
   * projects need their dependencies updated.
   */
  private bumpedProjects: Set<string> = new Set();

  /**
   * versionData that will ultimately be returned to the nx release version handler by getVersionData()
   */
  private versionData: Map<
    string, // project name
    VersionDataEntry
  > = new Map();

  /**
   * If the user provided a specifier at the time of versioning we store it here so that it can take priority
   * over any configuration.
   */
  private userGivenSpecifier: string | undefined;

  /**
   * Track any version plan files that have been processed so that we can delete them after versioning is complete,
   * while leaving any unprocessed files in place.
   */
  private processedVersionPlanFiles = new Set<string>();

  constructor(
    private tree: Tree,
    private projectGraph: ProjectGraph,
    private nxReleaseConfig: NxReleaseConfig,
    private releaseGraph: ReleaseGraph,
    private options: ReleaseGroupProcessorOptions
  ) {
    /**
     * To match legacy versioning behavior in the case of semver versions with leading "v" characters,
     * e.g. "v1.0.0", we strip the leading "v" and use the rest of the string as the user given specifier
     * to ensure that it is valid. If it is a non-semver version, we just use the string as is.
     *
     * TODO: re-evaluate if this is definitely what we want... Maybe we can just delegate isValid to the
     * version actions implementation during prompting?
     */
    if (options.userGivenSpecifier?.startsWith('v')) {
      const userGivenSpecifierWithoutLeadingV =
        options.userGivenSpecifier?.replace(/^v/, '');
      if (semver.valid(userGivenSpecifierWithoutLeadingV)) {
        this.userGivenSpecifier = userGivenSpecifierWithoutLeadingV;
      }
    } else {
      this.userGivenSpecifier = options.userGivenSpecifier;
    }

    // Ensure that there is an entry in versionData for each project being processed
    for (const projectName of this.releaseGraph.allProjectsToProcess) {
      this.versionData.set(projectName, {
        currentVersion: this.getCurrentCachedVersionForProject(projectName),
        newVersion: null,
        dockerVersion: null,
        dependentProjects: this.getOriginalDependentProjects(projectName),
      });
    }
  }

  getReleaseGroupNameForProject(projectName: string): string | null {
    const group = this.releaseGraph.projectToReleaseGroup.get(projectName);
    return group ? group.name : null;
  }

  getNextGroup(): string | null {
    for (const [groupName, groupNode] of this.releaseGraph.groupGraph) {
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

    // Use the topologically sorted groups
    for (const nextGroup of this.releaseGraph.sortedReleaseGroups) {
      // Skip groups that have already been processed (could happen with circular dependencies)
      if (this.processedGroups.has(nextGroup)) {
        continue;
      }
      // The next group might not present in the groupGraph if it has been filtered out
      if (!this.releaseGraph.groupGraph.has(nextGroup)) {
        continue;
      }

      const allDependenciesProcessed = Array.from(
        this.releaseGraph.groupGraph.get(nextGroup)!.dependencies
      ).every((dep) => this.processedGroups.has(dep));

      if (!allDependenciesProcessed) {
        // If we encounter a group whose dependencies aren't all processed,
        // it means there's a circular dependency that our topological sort broke.
        // We need to process any unprocessed dependencies first.
        for (const dep of this.releaseGraph.groupGraph.get(nextGroup)!
          .dependencies) {
          if (!this.processedGroups.has(dep)) {
            // The next group might not present in the groupGraph if it has been filtered out
            if (!this.releaseGraph.groupGraph.has(dep)) {
              continue;
            }
            await this.processGroup(dep);
            this.processedGroups.add(dep);
            processOrder.push(dep);
          }
        }
      }

      await this.processGroup(nextGroup);
      this.processedGroups.add(nextGroup);
      processOrder.push(nextGroup);
    }

    return processOrder;
  }

  flushAllProjectLoggers() {
    for (const projectLogger of this.releaseGraph.projectLoggers.values()) {
      projectLogger.flush();
    }
  }

  deleteProcessedVersionPlanFiles(): void {
    for (const versionPlanPath of this.processedVersionPlanFiles) {
      this.tree.delete(versionPlanPath);
    }
  }

  getVersionData(): VersionData {
    return Object.fromEntries(this.versionData);
  }

  /**
   * Invoke the afterAllProjectsVersioned functions for each unique versionActions type.
   * This can be useful for performing actions like updating a workspace level lock file.
   *
   * Because the tree has already been flushed to disk at this point, each afterAllProjectsVersioned
   * function is responsible for returning the list of changed and deleted files that it affected.
   *
   * The root level `release.version.versionActionsOptions` is what is passed in here because this
   * is a one time action for the whole workspace. Release group and project level overrides are
   * not applicable.
   */
  async afterAllProjectsVersioned(
    rootVersionActionsOptions: Record<string, unknown>
  ): Promise<{
    changedFiles: string[];
    deletedFiles: string[];
  }> {
    const changedFiles = new Set<string>();
    const deletedFiles = new Set<string>();

    for (const [, afterAllProjectsVersioned] of this.releaseGraph
      .uniqueAfterAllProjectsVersioned) {
      const {
        changedFiles: changedFilesForVersionActions,
        deletedFiles: deletedFilesForVersionActions,
      } = await afterAllProjectsVersioned(this.tree.root, {
        dryRun: this.options.dryRun,
        verbose: this.options.verbose,
        rootVersionActionsOptions,
      });

      for (const file of changedFilesForVersionActions) {
        changedFiles.add(file);
      }
      for (const file of deletedFilesForVersionActions) {
        deletedFiles.add(file);
      }
    }

    return {
      changedFiles: Array.from(changedFiles),
      deletedFiles: Array.from(deletedFiles),
    };
  }

  async processDockerProjects(
    dockerVersionScheme?: string,
    dockerVersion?: string
  ) {
    const dockerProjects = new Map<string, FinalConfigForProject>();
    for (const project of this.versionData.keys()) {
      const hasDockerTechnology = Object.values(
        this.projectGraph.nodes[project]?.data?.targets ?? []
      ).some(({ metadata }) => metadata?.technologies?.includes('docker'));
      if (!hasDockerTechnology) {
        continue;
      }
      const finalConfigForProject =
        this.releaseGraph.finalConfigsByProject.get(project);
      dockerProjects.set(project, finalConfigForProject);
    }
    // If no docker projects to process, exit early to avoid unnecessary loading of docker handling
    if (dockerProjects.size === 0) {
      return;
    }
    let handleDockerVersion: (
      workspaceRoot: string,
      projectGraphNode: ProjectGraphProjectNode,
      finalConfigForProject: FinalConfigForProject,
      dockerVersionScheme?: string,
      dockerVersion?: string,
      versionActionsVersion?: string
    ) => Promise<{ newVersion: string; logs: string[] }>;
    try {
      const {
        handleDockerVersion: _handleDockerVersion,
        // nx-ignore-next-line
      } = require(// @ts-ignore
      '@nx/docker/release/version-utils');
      handleDockerVersion = _handleDockerVersion;
    } catch (e) {
      console.error(
        'Could not find `@nx/docker`. Please run `nx add @nx/docker` before attempting to release Docker images.'
      );
      throw e;
    }
    for (const [project, finalConfigForProject] of dockerProjects.entries()) {
      const projectNode = this.projectGraph.nodes[project];
      const projectVersionData = this.versionData.get(project);
      const { newVersion, logs } = await handleDockerVersion(
        workspaceRoot,
        projectNode,
        finalConfigForProject,
        dockerVersionScheme,
        dockerVersion,
        projectVersionData.newVersion
      );

      logs.forEach((log) =>
        this.getProjectLoggerForProject(project).buffer(log)
      );
      const newVersionData = {
        ...projectVersionData,
        dockerVersion: newVersion,
      };
      this.versionData.set(project, newVersionData);
    }
    this.flushAllProjectLoggers();
  }

  private async processGroup(releaseGroupName: string): Promise<void> {
    const groupNode = this.releaseGraph.groupGraph.get(releaseGroupName)!;
    await this.bumpVersions(groupNode.group);

    // Flush the project loggers for the group
    for (const project of groupNode.group.projects) {
      const projectLogger = this.getProjectLoggerForProject(project);
      projectLogger.flush();
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
    const {
      newVersionInput,
      newVersionInputReason,
      newVersionInputReasonData,
    } = await this.determineVersionBumpForProject(releaseGroup, firstProject);

    if (newVersionInput === 'none') {
      // No direct bump for this group, but we may still need to bump if a dependency group has been bumped
      let bumpedByDependency = false;

      // Use sorted projects to check for dependencies in processed groups
      const sortedProjects =
        this.releaseGraph.sortedProjects.get(releaseGroup.name) || [];

      // Iterate through each project in the release group in topological order
      for (const project of sortedProjects) {
        const dependencies = this.projectGraph.dependencies[project] || [];
        for (const dep of dependencies) {
          const depGroup = this.getReleaseGroupNameForProject(dep.target);
          if (
            depGroup &&
            depGroup !== releaseGroup.name &&
            this.processedGroups.has(depGroup)
          ) {
            const depGroupBumpType =
              await this.getFixedReleaseGroupBumpType(depGroup);

            // If a dependency group has been bumped, determine if it should trigger a bump in this group
            if (depGroupBumpType !== 'none') {
              bumpedByDependency = true;
              const depBumpType = this.determineSideEffectBump(
                releaseGroup,
                depGroupBumpType as SemverBumpType
              );
              await this.bumpVersionForProject(
                project,
                depBumpType,
                'DEPENDENCY_ACROSS_GROUPS_WAS_BUMPED',
                {}
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
        // Update all projects in topological order
        for (const project of sortedProjects) {
          if (!this.bumpedProjects.has(project)) {
            await this.bumpVersionForProject(
              project,
              'patch',
              'OTHER_PROJECT_IN_FIXED_GROUP_WAS_BUMPED_DUE_TO_DEPENDENCY',
              {}
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
            dockerVersion: null,
            dependentProjects: this.getOriginalDependentProjects(project),
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
      newVersionInput,
      newVersionInputReason,
      newVersionInputReasonData
    );

    // Use sorted projects for processing projects in the right order
    const sortedProjects =
      this.releaseGraph.sortedProjects.get(releaseGroup.name) ||
      releaseGroup.projects;

    // First, update versions for all projects in the fixed group in topological order
    for (const project of sortedProjects) {
      const versionActions = this.getVersionActionsForProject(project);
      const projectLogger = this.getProjectLoggerForProject(project);
      const currentVersion = this.getCurrentCachedVersionForProject(project);

      // The first project's version was determined above, so this log is only appropriate for the remaining projects
      if (project !== firstProject) {
        projectLogger.buffer(
          `❓ Applied version ${newVersion} directly, because the project is a member of a fixed release group containing ${firstProject}`
        );
      }

      /**
       * Update the project's version based on the implementation details of the configured VersionActions
       * and display any returned log messages to the user.
       */
      const logMessages = await versionActions.updateProjectVersion(
        this.tree,
        newVersion
      );
      for (const logMessage of logMessages) {
        projectLogger.buffer(logMessage);
      }

      this.bumpedProjects.add(project);
      bumped = true;

      // Populate version data for each project
      this.versionData.set(project, {
        currentVersion,
        newVersion,
        dependentProjects: this.getOriginalDependentProjects(project),
      });
    }

    // Then, update dependencies for all projects in the fixed group, also in topological order
    if (bumped) {
      for (const project of sortedProjects) {
        await this.updateDependenciesForProject(project);
      }
    }

    return bumped;
  }

  private async bumpIndependentVersionGroup(
    releaseGroup: ReleaseGroupWithName
  ): Promise<boolean> {
    const releaseGroupFilteredProjects =
      this.releaseGraph.releaseGroupToFilteredProjects.get(releaseGroup);

    let bumped = false;
    const projectBumpTypes = new Map<
      string,
      {
        bumpType: SemverBumpType | SemverVersion;
        bumpTypeReason: keyof typeof BUMP_TYPE_REASON_TEXT;
        bumpTypeReasonData: Record<string, unknown>;
      }
    >();
    const projectsToUpdate = new Set<string>();

    // First pass: Determine bump types (only for projects in this release group)
    for (const project of releaseGroupFilteredProjects) {
      const {
        newVersionInput: bumpType,
        newVersionInputReason: bumpTypeReason,
        newVersionInputReasonData: bumpTypeReasonData,
      } = await this.determineVersionBumpForProject(releaseGroup, project);
      projectBumpTypes.set(project, {
        bumpType,
        bumpTypeReason,
        bumpTypeReasonData,
      });
      if (bumpType !== 'none') {
        projectsToUpdate.add(project);
      }
    }

    // Second pass: Update versions using topologically sorted projects
    // This ensures dependencies are processed before dependents
    const sortedProjects =
      this.releaseGraph.sortedProjects.get(releaseGroup.name) || [];

    // Process projects in topological order
    for (const project of sortedProjects) {
      if (
        projectsToUpdate.has(project) &&
        releaseGroupFilteredProjects.has(project)
      ) {
        const {
          bumpType: finalBumpType,
          bumpTypeReason: finalBumpTypeReason,
          bumpTypeReasonData: finalBumpTypeReasonData,
        } = projectBumpTypes.get(project)!;
        if (finalBumpType !== 'none') {
          await this.bumpVersionForProject(
            project,
            finalBumpType,
            finalBumpTypeReason,
            finalBumpTypeReasonData
          );
          this.bumpedProjects.add(project);
          bumped = true;
        }
      }
    }

    // Third pass: Update dependencies also in topological order
    for (const project of sortedProjects) {
      if (
        projectsToUpdate.has(project) &&
        releaseGroupFilteredProjects.has(project)
      ) {
        await this.updateDependenciesForProject(project);
      }
    }

    return bumped;
  }

  private async determineVersionBumpForProject(
    releaseGroup: ReleaseGroupWithName,
    projectName: string
  ): Promise<{
    newVersionInput: SemverBumpType | SemverVersion;
    newVersionInputReason: keyof typeof BUMP_TYPE_REASON_TEXT;
    newVersionInputReasonData: Record<string, unknown>;
  }> {
    // User given specifier has the highest precedence
    if (this.userGivenSpecifier) {
      return {
        newVersionInput: this.userGivenSpecifier as SemverBumpType,
        newVersionInputReason: 'USER_SPECIFIER',
        newVersionInputReasonData: {},
      };
    }

    const projectGraphNode = this.projectGraph.nodes[projectName];
    const projectLogger = this.getProjectLoggerForProject(projectName);
    const cachedFinalConfigForProject =
      this.getCachedFinalConfigForProject(projectName);

    if (
      cachedFinalConfigForProject.specifierSource === 'conventional-commits'
    ) {
      const currentVersion =
        this.getCurrentCachedVersionForProject(projectName);
      const bumpType = await deriveSpecifierFromConventionalCommits(
        this.nxReleaseConfig,
        this.projectGraph,
        projectLogger,
        releaseGroup,
        projectGraphNode,
        !!semver.prerelease(currentVersion ?? ''),
        this.releaseGraph.cachedLatestMatchingGitTag.get(projectName),
        this.releaseGraph,
        cachedFinalConfigForProject.fallbackCurrentVersionResolver,
        this.options.preid
      );
      return {
        newVersionInput: bumpType,
        newVersionInputReason: 'CONVENTIONAL_COMMITS',
        newVersionInputReasonData: {},
      };
    }

    // Resolve the semver relative bump via version-plans
    if (releaseGroup.versionPlans) {
      const currentVersion =
        this.getCurrentCachedVersionForProject(projectName);
      const { bumpType, versionPlanPath } =
        await deriveSpecifierFromVersionPlan(
          projectLogger,
          releaseGroup,
          projectGraphNode,
          currentVersion
        );
      if (bumpType !== 'none') {
        this.processedVersionPlanFiles.add(versionPlanPath);
      }
      return {
        newVersionInput: bumpType,
        newVersionInputReason: 'VERSION_PLANS',
        newVersionInputReasonData: {
          versionPlanPath,
        },
      };
    }

    // Only add the release group name to the log if it is one set by the user, otherwise it is useless noise
    const maybeLogReleaseGroup = (log: string): string => {
      if (releaseGroup.name === IMPLICIT_DEFAULT_RELEASE_GROUP) {
        return log;
      }
      return `${log} within release group "${releaseGroup.name}"`;
    };
    const versionActions = this.getVersionActionsForProject(projectName);
    if (versionActions instanceof NOOP_VERSION_ACTIONS) {
      return {
        newVersionInput: 'none',
        newVersionInputReason: 'NOOP_VERSION_ACTIONS',
        newVersionInputReasonData: {},
      };
    }

    if (cachedFinalConfigForProject.specifierSource === 'prompt') {
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
        newVersionInput: specifier,
        newVersionInputReason: 'PROMPTED_USER_SPECIFIER',
        newVersionInputReasonData: {},
      };
    }

    throw new Error(
      `Unhandled version bump config, please report this as a bug on https://github.com/nrwl/nx/issues`
    );
  }

  private getVersionActionsForProject(projectName: string): VersionActions {
    const versionActions =
      this.releaseGraph.projectsToVersionActions.get(projectName);
    if (!versionActions) {
      throw new Error(
        `No versionActions found for project ${projectName}, please report this as a bug on https://github.com/nrwl/nx/issues`
      );
    }
    return versionActions;
  }

  private getProjectLoggerForProject(projectName: string): ProjectLogger {
    const projectLogger = this.releaseGraph.projectLoggers.get(projectName);
    if (!projectLogger) {
      throw new Error(
        `No project logger found for project ${projectName}, please report this as a bug on https://github.com/nrwl/nx/issues`
      );
    }
    return projectLogger;
  }

  private getCurrentCachedVersionForProject(
    projectName: string
  ): string | null {
    return this.releaseGraph.cachedCurrentVersions.get(projectName);
  }

  private getCachedFinalConfigForProject(
    projectName: string
  ): NxReleaseVersionConfiguration {
    const cachedFinalConfig =
      this.releaseGraph.finalConfigsByProject.get(projectName);
    if (!cachedFinalConfig) {
      throw new Error(
        `Unexpected error: No cached config found for project ${projectName}, please report this as a bug on https://github.com/nrwl/nx/issues`
      );
    }
    return cachedFinalConfig;
  }

  private async calculateNewVersion(
    project: string,
    newVersionInput: string, // any arbitrary string, whether or not it is valid is dependent upon the version actions implementation
    newVersionInputReason: keyof typeof BUMP_TYPE_REASON_TEXT,
    newVersionInputReasonData: Record<string, unknown>
  ): Promise<{ currentVersion: string | null; newVersion: string }> {
    const currentVersion = this.getCurrentCachedVersionForProject(project);
    const versionActions = this.getVersionActionsForProject(project);
    const { newVersion, logText } = await versionActions.calculateNewVersion(
      currentVersion,
      newVersionInput,
      newVersionInputReason,
      newVersionInputReasonData,
      this.options.preid
    );
    const projectLogger = this.getProjectLoggerForProject(project);
    projectLogger.buffer(logText);
    return { currentVersion, newVersion };
  }

  private async updateDependenciesForProject(
    projectName: string
  ): Promise<void> {
    if (!this.releaseGraph.allProjectsToProcess.has(projectName)) {
      throw new Error(
        `Unable to find ${projectName} in allProjectsToProcess, please report this as a bug on https://github.com/nrwl/nx/issues`
      );
    }

    const versionActions = this.getVersionActionsForProject(projectName);
    const cachedFinalConfigForProject =
      this.getCachedFinalConfigForProject(projectName);

    const dependenciesToUpdate: Record<string, string> = {};
    const dependencies = this.projectGraph.dependencies[projectName] || [];

    for (const dep of dependencies) {
      if (this.releaseGraph.allProjectsToProcess.has(dep.target)) {
        const targetVersionData = this.versionData.get(dep.target);
        if (targetVersionData) {
          const { currentVersion: currentDependencyVersion } =
            await versionActions.readCurrentVersionOfDependency(
              this.tree,
              this.projectGraph,
              dep.target
            );
          if (!currentDependencyVersion) {
            continue;
          }
          let finalPrefix = '';
          if (cachedFinalConfigForProject.versionPrefix === 'auto') {
            const prefixMatch = currentDependencyVersion?.match(/^([~^=])/);
            finalPrefix = prefixMatch ? prefixMatch[1] : '';
          } else if (
            ['~', '^', '='].includes(cachedFinalConfigForProject.versionPrefix)
          ) {
            finalPrefix = cachedFinalConfigForProject.versionPrefix;
          }

          const newVersion =
            targetVersionData.newVersion ??
            this.releaseGraph.cachedCurrentVersions.get(dep.target) ??
            currentDependencyVersion;

          // Remove any existing prefix from the new version before applying the finalPrefix
          const cleanNewVersion = newVersion.replace(/^[~^=]/, '');
          dependenciesToUpdate[dep.target] = `${finalPrefix}${cleanNewVersion}`;
        }
      }
    }

    const projectLogger = this.getProjectLoggerForProject(projectName);
    const logMessages = await versionActions.updateProjectDependencies(
      this.tree,
      this.projectGraph,
      dependenciesToUpdate
    );
    for (const logMessage of logMessages) {
      projectLogger.buffer(logMessage);
    }
  }

  private async bumpVersionForProject(
    projectName: string,
    bumpType: SemverBumpType | SemverVersion,
    bumpTypeReason: keyof typeof BUMP_TYPE_REASON_TEXT,
    bumpTypeReasonData: Record<string, unknown>
  ): Promise<void> {
    const projectLogger = this.getProjectLoggerForProject(projectName);

    if (bumpType === 'none') {
      projectLogger.buffer(
        `⏩ Skipping bump for ${projectName} as bump type is "none"`
      );
      return;
    }

    const versionActions = this.getVersionActionsForProject(projectName);

    const { currentVersion, newVersion } = await this.calculateNewVersion(
      projectName,
      bumpType,
      bumpTypeReason,
      bumpTypeReasonData
    );

    /**
     * Update the project's version based on the implementation details of the configured VersionActions
     * and display any returned log messages to the user.
     */
    const logMessages = await versionActions.updateProjectVersion(
      this.tree,
      newVersion
    );
    for (const logMessage of logMessages) {
      projectLogger.buffer(logMessage);
    }

    // Update version data and bumped projects
    this.versionData.set(projectName, {
      currentVersion,
      newVersion,
      dependentProjects: this.getOriginalDependentProjects(projectName),
    });
    this.bumpedProjects.add(projectName);

    // Find the release group for this project
    const releaseGroupName = this.getReleaseGroupNameForProject(projectName);
    if (!releaseGroupName) {
      projectLogger.buffer(
        `⚠️ Cannot find release group for ${projectName}, skipping dependent updates`
      );
      return;
    }

    const releaseGroup =
      this.releaseGraph.groupGraph.get(releaseGroupName)!.group;
    const releaseGroupVersionConfig =
      releaseGroup.version as NxReleaseVersionConfiguration;

    // Get updateDependents from the release group level config
    const updateDependents =
      (releaseGroupVersionConfig?.updateDependents as
        | 'auto'
        | 'always'
        | 'never') || 'always';

    // Only update dependencies for dependents if the group's updateDependents is 'auto' or 'always'
    if (updateDependents === 'auto' || updateDependents === 'always') {
      const dependents = this.getNonImplicitDependentsForProject(projectName);
      // Only process dependents that are actually being processed
      const dependentsToProcess = dependents.filter((dep) =>
        this.releaseGraph.allProjectsToProcess.has(dep)
      );

      await this.updateDependenciesForDependents(dependentsToProcess);

      for (const dependent of dependentsToProcess) {
        if (!this.bumpedProjects.has(dependent)) {
          await this.bumpVersionForProject(
            dependent,
            'patch',
            'DEPENDENCY_WAS_BUMPED',
            {}
          );
        }
      }
    } else {
      const releaseGroupText =
        releaseGroupName !== IMPLICIT_DEFAULT_RELEASE_GROUP
          ? ` in release group "${releaseGroupName}" `
          : ' ';
      projectLogger.buffer(
        `⏩ Skipping dependent updates as "updateDependents"${releaseGroupText}is not "auto"`
      );
    }
  }

  private async updateDependenciesForDependents(
    dependents: string[]
  ): Promise<void> {
    for (const dependent of dependents) {
      if (!this.releaseGraph.allProjectsToProcess.has(dependent)) {
        throw new Error(
          `Unable to find project "${dependent}" in allProjectsToProcess, please report this as a bug on https://github.com/nrwl/nx/issues`
        );
      }
      await this.updateDependenciesForProject(dependent);
    }
  }

  private getOriginalDependentProjects(
    project: string
  ): VersionDataEntry['dependentProjects'] {
    return (
      this.releaseGraph.originalDependentProjectsPerProject.get(project) || []
    );
  }

  private async getFixedReleaseGroupBumpType(
    releaseGroupName: string
  ): Promise<SemverBumpType | SemverVersion> {
    const releaseGroup =
      this.releaseGraph.groupGraph.get(releaseGroupName)!.group;
    const releaseGroupFilteredProjects =
      this.releaseGraph.releaseGroupToFilteredProjects.get(releaseGroup);
    if (releaseGroupFilteredProjects.size === 0) {
      return 'none';
    }

    // It's a fixed release group, so we can just pick any project in the group
    const anyProject = releaseGroupFilteredProjects.values().next().value;
    // If already bumped, no need to re-calculate it
    const { currentVersion, newVersion } = this.versionData.get(anyProject);
    if (newVersion) {
      return semver.diff(currentVersion, newVersion);
    }

    return (await this.determineVersionBumpForProject(releaseGroup, anyProject))
      .newVersionInput;
  }

  // TODO: Support influencing the side effect bump in a future version, always patch for now like in legacy versioning
  private determineSideEffectBump(
    releaseGroup: ReleaseGroupWithName,
    dependencyBumpType: SemverBumpType
  ): SemverBumpType {
    const sideEffectBump = 'patch';
    return sideEffectBump as SemverBumpType;
  }

  private getProjectDependents(project: string): Set<string> {
    return this.releaseGraph.projectToDependents.get(project) || new Set();
  }

  private getNonImplicitDependentsForProject(project: string): string[] {
    // Use the cached dependents for O(1) lookup instead of O(n) scan
    return Array.from(this.getProjectDependents(project));
  }
}

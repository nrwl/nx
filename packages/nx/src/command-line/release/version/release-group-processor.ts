import * as semver from 'semver';
import {
  ManifestRootToUpdate,
  NxReleaseVersionConfiguration,
} from '../../../config/nx-json';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import { Tree } from '../../../generators/tree';
import {
  IMPLICIT_DEFAULT_RELEASE_GROUP,
  type NxReleaseConfig,
} from '../config/config';
import type { ReleaseGroupWithName } from '../config/filter-release-groups';
import { getLatestGitTagForPattern } from '../utils/git';
import { resolveSemverSpecifierFromPrompt } from '../utils/resolve-semver-specifier';
import type { VersionData, VersionDataEntry } from '../utils/shared';
import { validReleaseVersionPrefixes } from '../version';
import { deriveSpecifierFromConventionalCommits } from './derive-specifier-from-conventional-commits';
import { deriveSpecifierFromVersionPlan } from './deriver-specifier-from-version-plans';
import { ProjectLogger } from './project-logger';
import { resolveCurrentVersion } from './resolve-current-version';
import { topologicalSort } from './topological-sort';
import {
  AfterAllProjectsVersioned,
  resolveVersionActionsForProject,
  SemverBumpType,
  VersionActions,
} from './version-actions';

/**
 * The final configuration for a project after applying release group and project level overrides,
 * as well as default values. This will be passed to the relevant version actions implementation,
 * and referenced throughout the versioning process.
 */
export interface FinalConfigForProject {
  specifierSource: NxReleaseVersionConfiguration['specifierSource'];
  currentVersionResolver: NxReleaseVersionConfiguration['currentVersionResolver'];
  currentVersionResolverMetadata: NxReleaseVersionConfiguration['currentVersionResolverMetadata'];
  fallbackCurrentVersionResolver: NxReleaseVersionConfiguration['fallbackCurrentVersionResolver'];
  versionPrefix: NxReleaseVersionConfiguration['versionPrefix'];
  preserveLocalDependencyProtocols: NxReleaseVersionConfiguration['preserveLocalDependencyProtocols'];
  versionActionsOptions: NxReleaseVersionConfiguration['versionActionsOptions'];
  // Consistently expanded to the object form for easier processing in VersionActions
  manifestRootsToUpdate: Array<Exclude<ManifestRootToUpdate, string>>;
}

interface GroupNode {
  group: ReleaseGroupWithName;
  dependencies: Set<string>;
  dependents: Set<string>;
}

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
   * Stores the relationships between release groups, including their dependencies
   * and dependents. This is used for determining processing order and propagating
   * version changes between related groups.
   */
  private groupGraph: Map<string, GroupNode> = new Map();

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
   * Cache of release groups sorted in topological order to ensure dependencies
   * are processed before dependents. Computed once and reused throughout processing.
   */
  private sortedReleaseGroups: string[] = [];

  /**
   * Maps each release group to its projects sorted in topological order.
   * Ensures projects are processed after their dependencies within each group.
   */
  private sortedProjects: Map<string, string[]> = new Map();

  /**
   * Track the unique afterAllProjectsVersioned functions involved in the current versioning process,
   * so that we can ensure they are only invoked once per versioning execution.
   */
  private uniqueAfterAllProjectsVersioned: Map<
    string,
    AfterAllProjectsVersioned
  > = new Map();

  /**
   * Track the versionActions for each project so that we can invoke certain instance methods.
   */
  private projectsToVersionActions: Map<string, VersionActions> = new Map();

  /**
   * versionData that will ultimately be returned to the nx release version handler by getVersionData()
   */
  private versionData: Map<
    string, // project name
    VersionDataEntry
  > = new Map();

  /**
   * Set of all projects that are configured in the nx release config.
   * Used to validate dependencies and identify projects that should be updated.
   */
  private allProjectsConfiguredForNxRelease: Set<string> = new Set();

  /**
   * Set of projects that will be processed in the current run.
   * This is potentially a subset of allProjectsConfiguredForNxRelease based on filters
   * and dependency relationships.
   */
  private allProjectsToProcess: Set<string> = new Set();

  /**
   * If the user provided a specifier at the time of versioning we store it here so that it can take priority
   * over any configuration.
   */
  private userGivenSpecifier: string | undefined;

  /**
   * Caches the current version of each project to avoid repeated disk/registry/git tag lookups.
   * Often used during new version calculation. Will be null if the current version resolver is set to 'none'.
   */
  private cachedCurrentVersions: Map<
    string, // project name
    string | null // current version
  > = new Map();

  /**
   * Caches git tag information for projects that resolve their version from git tags.
   * This avoids performing expensive git operations multiple times for the same project.
   */
  private cachedLatestMatchingGitTag: Map<
    string, // project name
    Awaited<ReturnType<typeof getLatestGitTagForPattern>>
  > = new Map();

  /**
   * Temporary storage for dependent project names while building the dependency graph.
   * This is used as an intermediate step before creating the full dependent projects data.
   */
  private tmpCachedDependentProjects: Map<
    string, // project name
    string[] // dependent project names
  > = new Map();

  /**
   * Resolve the data regarding dependent projects for each project upfront so that it remains accurate
   * even after updates are applied to manifests.
   */
  private originalDependentProjectsPerProject: Map<
    string, // project name
    VersionDataEntry['dependentProjects']
  > = new Map();

  /**
   * In the case of fixed release groups that are configured to resolve the current version from a registry
   * or a git tag, it would be a waste of time and resources to resolve the current version for each individual
   * project, therefore we maintain a cache of the current version for each applicable fixed release group here.
   */
  private currentVersionsPerFixedReleaseGroup: Map<
    string, // release group name
    {
      currentVersion: string;
      originatingProjectName: string;
      logText: string;
    }
  > = new Map();

  /**
   * Cache of project loggers for each project.
   */
  private projectLoggers: Map<string, ProjectLogger> = new Map();

  /**
   * Track any version plan files that have been processed so that we can delete them after versioning is complete,
   * while leaving any unprocessed files in place.
   */
  private processedVersionPlanFiles = new Set<string>();

  /**
   * Certain configuration options can be overridden at the project level, and otherwise fall back to the release group level.
   * Many also have a specific default value if nothing is set at either level. To avoid applying this hierarchy for each project
   * every time such a configuration option is needed, we cache the result per project here.
   */
  private finalConfigsByProject: Map<string, FinalConfigForProject> = new Map();

  /**
   * Maps each project to its release group for quick O(1) lookups.
   * This avoids having to scan through all release groups to find a project.
   */
  private projectToReleaseGroup: Map<string, ReleaseGroupWithName> = new Map();

  /**
   * Maps each project to its dependents (projects that depend on it).
   * This is the inverse of the projectToDependencies map and enables
   * efficient lookup of dependent projects for propagating version changes.
   */
  private projectToDependents: Map<string, Set<string>> = new Map();

  /**
   * Maps each project to its dependencies (projects it depends on).
   * Used for building dependency graphs and determining processing order.
   */
  private projectToDependencies: Map<string, Set<string>> = new Map();

  /**
   * Caches the updateDependents setting for each project to avoid repeated
   * lookups and calculations. This determines if dependent projects should
   * be automatically updated when a dependency changes.
   */
  private projectToUpdateDependentsSetting: Map<string, 'auto' | 'never'> =
    new Map();

  constructor(
    private tree: Tree,
    private projectGraph: ProjectGraph,
    private nxReleaseConfig: NxReleaseConfig,
    private releaseGroups: ReleaseGroupWithName[],
    private releaseGroupToFilteredProjects: Map<
      ReleaseGroupWithName,
      Set<string>
    >,
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
  }

  /**
   * Initialize the processor by building the group graph and preparing for processing.
   * This method must be called before processGroups().
   */
  async init(): Promise<void> {
    // Precompute project to release group mapping for O(1) lookups
    this.setupProjectReleaseGroupMapping();

    // Setup projects to process and resolve version actions
    await this.setupProjectsToProcess();

    // Precompute dependency relationships
    await this.precomputeDependencyRelationships();

    // Process dependency graph to find dependents to process
    this.findDependentsToProcess();

    // Build the group graph structure
    for (const group of this.releaseGroups) {
      this.groupGraph.set(group.name, {
        group,
        dependencies: new Set(),
        dependents: new Set(),
      });
    }

    // Process each project within each release group
    for (const [, releaseGroupNode] of this.groupGraph) {
      for (const projectName of releaseGroupNode.group.projects) {
        const projectGraphNode = this.projectGraph.nodes[projectName];

        // Check if the project has been filtered out of explicit versioning before continuing any further
        if (!this.allProjectsToProcess.has(projectName)) {
          continue;
        }

        const versionActions = this.getVersionActionsForProject(projectName);
        const finalConfigForProject =
          this.getFinalConfigForProject(projectName);

        let latestMatchingGitTag:
          | Awaited<ReturnType<typeof getLatestGitTagForPattern>>
          | undefined;
        const releaseTagPattern = releaseGroupNode.group.releaseTagPattern;
        // Cache the last matching git tag for relevant projects
        if (finalConfigForProject.currentVersionResolver === 'git-tag') {
          latestMatchingGitTag = await getLatestGitTagForPattern(
            releaseTagPattern,
            {
              projectName: projectGraphNode.name,
            },
            {
              checkAllBranchesWhen: releaseGroupNode.group.releaseTagPatternCheckAllBranchesWhen,
              preId: this.options.preid,
            }
          );
          this.cachedLatestMatchingGitTag.set(
            projectName,
            latestMatchingGitTag
          );
        }

        // Cache the current version for the project
        const currentVersion = await resolveCurrentVersion(
          this.tree,
          projectGraphNode,
          releaseGroupNode.group,
          versionActions,
          this.projectLoggers.get(projectName)!,
          this.currentVersionsPerFixedReleaseGroup,
          finalConfigForProject,
          releaseTagPattern,
          latestMatchingGitTag
        );
        this.cachedCurrentVersions.set(projectName, currentVersion);
      }

      // Ensure that there is an entry in versionData for each project being processed, even if they don't end up being bumped
      for (const projectName of this.allProjectsToProcess) {
        this.versionData.set(projectName, {
          currentVersion: this.getCurrentCachedVersionForProject(projectName),
          newVersion: null,
          dependentProjects: this.getOriginalDependentProjects(projectName),
        });
      }
    }

    // Build the dependency relationships between groups
    this.buildGroupDependencyGraph();

    // Topologically sort the release groups and projects for efficient processing
    this.sortedReleaseGroups = this.topologicallySortReleaseGroups();

    // Sort projects within each release group
    for (const group of this.releaseGroups) {
      this.sortedProjects.set(
        group.name,
        this.topologicallySortProjects(group)
      );
    }

    // Populate the dependent projects data
    await this.populateDependentProjectsData();
  }

  /**
   * Setup mapping from project to release group and cache updateDependents settings
   */
  private setupProjectReleaseGroupMapping(): void {
    for (const group of this.releaseGroups) {
      for (const project of group.projects) {
        this.projectToReleaseGroup.set(project, group);

        // Cache updateDependents setting relevant for each project
        const updateDependents =
          ((group.version as NxReleaseVersionConfiguration)
            ?.updateDependents as 'auto' | 'never') || 'auto';
        this.projectToUpdateDependentsSetting.set(project, updateDependents);
      }
    }
  }

  /**
   * Determine which projects should be processed and resolve their version actions
   */
  private async setupProjectsToProcess(): Promise<void> {
    // Track the projects being directly versioned
    let projectsToProcess = new Set<string>();

    const resolveVersionActionsForProjectCallbacks = [];

    // Precompute all projects in nx release config
    for (const [groupName, group] of Object.entries(
      this.nxReleaseConfig.groups
    )) {
      for (const project of group.projects) {
        this.allProjectsConfiguredForNxRelease.add(project);
        // Create a project logger for the project
        this.projectLoggers.set(project, new ProjectLogger(project));

        // If group filtering is applied and the current group is captured by the filter, add the project to the projectsToProcess
        if (this.options.filters.groups?.includes(groupName)) {
          projectsToProcess.add(project);
          // Otherwise, if project filtering is applied and the current project is captured by the filter, add the project to the projectsToProcess
        } else if (this.options.filters.projects?.includes(project)) {
          projectsToProcess.add(project);
        }

        const projectGraphNode = this.projectGraph.nodes[project];

        /**
         * Try and resolve a cached ReleaseGroupWithName for the project. It may not be present
         * if the user filtered by group and excluded this parent group from direct versioning,
         * so fallback to the release group config and apply the name manually.
         */
        let releaseGroup = this.projectToReleaseGroup.get(project);
        if (!releaseGroup) {
          releaseGroup = {
            ...group,
            name: groupName,
            resolvedVersionPlans: false,
          };
        }

        // Resolve the final configuration for the project
        const finalConfigForProject = this.resolveFinalConfigForProject(
          releaseGroup,
          projectGraphNode
        );
        this.finalConfigsByProject.set(project, finalConfigForProject);

        /**
         * For our versionActions validation to accurate, we need to wait until the full allProjectsToProcess
         * set is populated so that all dependencies, including those across release groups, are included.
         *
         * In order to save us fully traversing the graph again to arrive at this project level, schedule a callback
         * to resolve the versionActions for the project only once we have all the projects to process.
         */
        resolveVersionActionsForProjectCallbacks.push(async () => {
          const {
            versionActionsPath,
            versionActions,
            afterAllProjectsVersioned,
          } = await resolveVersionActionsForProject(
            this.tree,
            releaseGroup,
            projectGraphNode,
            finalConfigForProject,
            // Will be fully populated by the time this callback is executed
            this.allProjectsToProcess.has(project)
          );
          if (!this.uniqueAfterAllProjectsVersioned.has(versionActionsPath)) {
            this.uniqueAfterAllProjectsVersioned.set(
              versionActionsPath,
              afterAllProjectsVersioned
            );
          }
          this.projectsToVersionActions.set(project, versionActions);
        });
      }
    }

    // If no filters are applied, process all projects
    if (
      !this.options.filters.groups?.length &&
      !this.options.filters.projects?.length
    ) {
      projectsToProcess = this.allProjectsConfiguredForNxRelease;
    }

    // If no projects are set to be processed, throw an error. This should be impossible because the filter validation in version.ts should have already caught this
    if (projectsToProcess.size === 0) {
      throw new Error(
        'No projects are set to be processed, please report this as a bug on https://github.com/nrwl/nx/issues'
      );
    }

    this.allProjectsToProcess = new Set(projectsToProcess);

    // Execute all the callbacks to resolve the version actions for the projects
    for (const cb of resolveVersionActionsForProjectCallbacks) {
      await cb();
    }
  }

  /**
   * Find all dependents that should be processed due to dependency updates
   */
  private findDependentsToProcess(): void {
    const projectsToProcess = Array.from(this.allProjectsToProcess);
    const allTrackedDependents = new Set<string>();
    const dependentsToProcess = new Set<string>();

    // BFS traversal of dependency graph to find all transitive dependents
    let currentLevel = [...projectsToProcess];

    while (currentLevel.length > 0) {
      const nextLevel: string[] = [];

      // Get all dependents for the current level at once
      const dependents = this.getAllNonImplicitDependents(currentLevel);

      // Process each dependent
      for (const dep of dependents) {
        // Skip if we've already seen this dependent or it's already in projectsToProcess
        if (
          allTrackedDependents.has(dep) ||
          this.allProjectsToProcess.has(dep)
        ) {
          continue;
        }

        // Track that we've seen this dependent
        allTrackedDependents.add(dep);

        // If both the dependent and its dependency have updateDependents='auto',
        // add the dependent to the projects to process
        if (this.hasAutoUpdateDependents(dep)) {
          // Check if any of its dependencies in the current level have auto update
          const hasDependencyWithAutoUpdate = currentLevel.some(
            (proj) =>
              this.hasAutoUpdateDependents(proj) &&
              this.getProjectDependents(proj).has(dep)
          );

          if (hasDependencyWithAutoUpdate) {
            dependentsToProcess.add(dep);
          }
        }

        // Add to next level for traversal
        nextLevel.push(dep);
      }

      // Move to next level
      currentLevel = nextLevel;
    }

    // Add all dependents that should be processed to allProjectsToProcess
    dependentsToProcess.forEach((dep) => this.allProjectsToProcess.add(dep));
  }

  private buildGroupDependencyGraph(): void {
    for (const [releaseGroupName, releaseGroupNode] of this.groupGraph) {
      for (const projectName of releaseGroupNode.group.projects) {
        const projectDeps = this.getProjectDependencies(projectName);
        for (const dep of projectDeps) {
          const dependencyGroup = this.getReleaseGroupNameForProject(dep);
          if (dependencyGroup && dependencyGroup !== releaseGroupName) {
            releaseGroupNode.dependencies.add(dependencyGroup);
            this.groupGraph
              .get(dependencyGroup)!
              .dependents.add(releaseGroupName);
          }
        }
      }
    }
  }

  private async populateDependentProjectsData(): Promise<void> {
    for (const [projectName, dependentProjectNames] of this
      .tmpCachedDependentProjects) {
      const dependentProjectsData: VersionDataEntry['dependentProjects'] = [];

      for (const dependentProjectName of dependentProjectNames) {
        const versionActions =
          this.getVersionActionsForProject(dependentProjectName);
        const { currentVersion, dependencyCollection } =
          await versionActions.readCurrentVersionOfDependency(
            this.tree,
            this.projectGraph,
            projectName
          );
        dependentProjectsData.push({
          source: dependentProjectName,
          target: projectName,
          type: 'static',
          dependencyCollection,
          rawVersionSpec: currentVersion,
        });
      }

      this.originalDependentProjectsPerProject.set(
        projectName,
        dependentProjectsData
      );
    }
  }

  getReleaseGroupNameForProject(projectName: string): string | null {
    const group = this.projectToReleaseGroup.get(projectName);
    return group ? group.name : null;
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

    // Use the topologically sorted groups instead of getNextGroup
    for (const nextGroup of this.sortedReleaseGroups) {
      // Skip groups that have already been processed (could happen with circular dependencies)
      if (this.processedGroups.has(nextGroup)) {
        continue;
      }

      const allDependenciesProcessed = Array.from(
        this.groupGraph.get(nextGroup)!.dependencies
      ).every((dep) => this.processedGroups.has(dep));

      if (!allDependenciesProcessed) {
        // If we encounter a group whose dependencies aren't all processed,
        // it means there's a circular dependency that our topological sort broke.
        // We need to process any unprocessed dependencies first.
        for (const dep of this.groupGraph.get(nextGroup)!.dependencies) {
          if (!this.processedGroups.has(dep)) {
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
    for (const projectLogger of this.projectLoggers.values()) {
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

    for (const [, afterAllProjectsVersioned] of this
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
    const {
      newVersionInput,
      newVersionInputReason,
      newVersionInputReasonData,
    } = await this.determineVersionBumpForProject(releaseGroup, firstProject);

    if (newVersionInput === 'none') {
      // No direct bump for this group, but we may still need to bump if a dependency group has been bumped
      let bumpedByDependency = false;

      // Use sorted projects to check for dependencies in processed groups
      const sortedProjects = this.sortedProjects.get(releaseGroup.name) || [];

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
            const depGroupBumpType = await this.getFixedReleaseGroupBumpType(
              depGroup
            );

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
      this.sortedProjects.get(releaseGroup.name) || releaseGroup.projects;

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
      this.releaseGroupToFilteredProjects.get(releaseGroup);

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

    // First pass: Determine bump types
    for (const project of this.allProjectsToProcess) {
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
    const sortedProjects = this.sortedProjects.get(releaseGroup.name) || [];

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
        this.cachedLatestMatchingGitTag.get(projectName),
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
    const versionActions = this.projectsToVersionActions.get(projectName);
    if (!versionActions) {
      throw new Error(
        `No versionActions found for project ${projectName}, please report this as a bug on https://github.com/nrwl/nx/issues`
      );
    }
    return versionActions;
  }

  private getFinalConfigForProject(projectName: string): FinalConfigForProject {
    const finalConfig = this.finalConfigsByProject.get(projectName);
    if (!finalConfig) {
      throw new Error(
        `No final config found for project ${projectName}, please report this as a bug on https://github.com/nrwl/nx/issues`
      );
    }
    return finalConfig;
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

  private getCurrentCachedVersionForProject(
    projectName: string
  ): string | null {
    return this.cachedCurrentVersions.get(projectName);
  }

  private getCachedFinalConfigForProject(
    projectName: string
  ): NxReleaseVersionConfiguration {
    const cachedFinalConfig = this.finalConfigsByProject.get(projectName);
    if (!cachedFinalConfig) {
      throw new Error(
        `Unexpected error: No cached config found for project ${projectName}, please report this as a bug on https://github.com/nrwl/nx/issues`
      );
    }
    return cachedFinalConfig;
  }

  /**
   * Apply project and release group precedence and default values, as well as validate the final configuration,
   * ready to be cached.
   */
  private resolveFinalConfigForProject(
    releaseGroup: ReleaseGroupWithName,
    projectGraphNode: ProjectGraphProjectNode
  ): FinalConfigForProject {
    const releaseGroupVersionConfig = releaseGroup.version as
      | NxReleaseVersionConfiguration
      | undefined;
    const projectVersionConfig = projectGraphNode.data.release?.version as
      | NxReleaseVersionConfiguration
      | undefined;

    /**
     * specifierSource
     *
     * If the user has provided a specifier, it always takes precedence,
     * so the effective specifier source is 'prompt', regardless of what
     * the project or release group config says.
     */
    const specifierSource = this.userGivenSpecifier
      ? 'prompt'
      : projectVersionConfig?.specifierSource ??
        releaseGroupVersionConfig?.specifierSource ??
        'prompt';

    /**
     * versionPrefix, defaults to auto
     */
    const versionPrefix =
      projectVersionConfig?.versionPrefix ??
      releaseGroupVersionConfig?.versionPrefix ??
      'auto';
    if (versionPrefix && !validReleaseVersionPrefixes.includes(versionPrefix)) {
      throw new Error(
        `Invalid value for versionPrefix: "${versionPrefix}"

Valid values are: ${validReleaseVersionPrefixes
          .map((s) => `"${s}"`)
          .join(', ')}`
      );
    }

    /**
     * currentVersionResolver, defaults to disk
     */
    const currentVersionResolver =
      projectVersionConfig?.currentVersionResolver ??
      releaseGroupVersionConfig?.currentVersionResolver ??
      'disk';
    if (
      specifierSource === 'conventional-commits' &&
      currentVersionResolver !== 'git-tag'
    ) {
      throw new Error(
        `Invalid currentVersionResolver "${currentVersionResolver}" provided for project "${projectGraphNode.name}". Must be "git-tag" when "specifierSource" is "conventional-commits"`
      );
    }

    /**
     * currentVersionResolverMetadata, defaults to {}
     */
    const currentVersionResolverMetadata =
      projectVersionConfig?.currentVersionResolverMetadata ??
      releaseGroupVersionConfig?.currentVersionResolverMetadata ??
      {};

    /**
     * preserveLocalDependencyProtocols
     *
     * This was false by default in legacy versioning, but is true by default now.
     */
    const preserveLocalDependencyProtocols =
      projectVersionConfig?.preserveLocalDependencyProtocols ??
      releaseGroupVersionConfig?.preserveLocalDependencyProtocols ??
      true;

    /**
     * fallbackCurrentVersionResolver, defaults to disk when performing a first release, otherwise undefined
     */
    const fallbackCurrentVersionResolver =
      projectVersionConfig?.fallbackCurrentVersionResolver ??
      releaseGroupVersionConfig?.fallbackCurrentVersionResolver ??
      // Always fall back to disk if this is the first release
      (this.options.firstRelease ? 'disk' : undefined);

    /**
     * versionActionsOptions, defaults to {}
     */
    let versionActionsOptions =
      projectVersionConfig?.versionActionsOptions ??
      releaseGroupVersionConfig?.versionActionsOptions ??
      {};
    // Apply any optional overrides that may be passed in from the programmatic API
    versionActionsOptions = {
      ...versionActionsOptions,
      ...(this.options.versionActionsOptionsOverrides ?? {}),
    };

    const manifestRootsToUpdate = (
      projectVersionConfig?.manifestRootsToUpdate ??
      releaseGroupVersionConfig?.manifestRootsToUpdate ??
      []
    ).map((manifestRoot) => {
      if (typeof manifestRoot === 'string') {
        return {
          path: manifestRoot,
          // Apply the project level preserveLocalDependencyProtocols setting that was already resolved
          preserveLocalDependencyProtocols,
        };
      }
      return manifestRoot;
    });

    return {
      specifierSource,
      currentVersionResolver,
      currentVersionResolverMetadata,
      fallbackCurrentVersionResolver,
      versionPrefix,
      preserveLocalDependencyProtocols,
      versionActionsOptions,
      manifestRootsToUpdate,
    };
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
    if (!this.allProjectsToProcess.has(projectName)) {
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
      if (
        this.allProjectsToProcess.has(dep.target) &&
        this.bumpedProjects.has(dep.target)
      ) {
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

          // Remove any existing prefix from the new version before applying the finalPrefix
          const cleanNewVersion = targetVersionData.newVersion.replace(
            /^[~^=]/,
            ''
          );
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

    const releaseGroup = this.groupGraph.get(releaseGroupName)!.group;
    const releaseGroupVersionConfig =
      releaseGroup.version as NxReleaseVersionConfiguration;

    // Get updateDependents from the release group level config
    const updateDependents =
      (releaseGroupVersionConfig?.updateDependents as 'auto' | 'never') ||
      'auto';

    // Only update dependencies for dependents if the group's updateDependents is 'auto'
    if (updateDependents === 'auto') {
      const dependents = this.getNonImplicitDependentsForProject(projectName);
      await this.updateDependenciesForDependents(dependents);

      for (const dependent of dependents) {
        if (
          this.allProjectsToProcess.has(dependent) &&
          !this.bumpedProjects.has(dependent)
        ) {
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
      if (!this.allProjectsToProcess.has(dependent)) {
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
    return this.originalDependentProjectsPerProject.get(project) || [];
  }

  private async propagateChanges(
    releaseGroupName: string,
    changedDependencyGroup: string
  ): Promise<void> {
    const releaseGroup = this.groupGraph.get(releaseGroupName)!.group;
    const releaseGroupFilteredProjects =
      this.releaseGroupToFilteredProjects.get(releaseGroup);

    // Get updateDependents from the release group level config
    const releaseGroupVersionConfig =
      releaseGroup.version as NxReleaseVersionConfiguration;
    const updateDependents =
      (releaseGroupVersionConfig?.updateDependents as 'auto' | 'never') ||
      'auto';

    // If updateDependents is not 'auto', skip propagating changes to this group
    if (updateDependents !== 'auto') {
      const projectLogger = this.getProjectLoggerForProject(
        releaseGroupFilteredProjects.values().next().value
      );
      projectLogger.buffer(
        `⏩ Skipping dependency updates for release group "${releaseGroupName}" as "updateDependents" is not "auto"`
      );
      return;
    }

    let groupBumped = false;
    let bumpType: SemverBumpType = 'none';

    if (releaseGroup.projectsRelationship === 'fixed') {
      // For fixed groups, we only need to check one project
      const project = releaseGroupFilteredProjects.values().next().value;
      const dependencies = this.projectGraph.dependencies[project] || [];
      const hasDependencyInChangedGroup = dependencies.some(
        (dep) =>
          this.getReleaseGroupNameForProject(dep.target) ===
          changedDependencyGroup
      );

      if (hasDependencyInChangedGroup) {
        const dependencyBumpType = await this.getFixedReleaseGroupBumpType(
          changedDependencyGroup
        );

        bumpType = this.determineSideEffectBump(
          releaseGroup,
          dependencyBumpType as SemverBumpType
        );
        groupBumped = bumpType !== 'none';
      }
    }

    if (groupBumped) {
      for (const project of releaseGroupFilteredProjects) {
        if (!this.bumpedProjects.has(project)) {
          await this.bumpVersionForProject(
            project,
            bumpType,
            'DEPENDENCY_ACROSS_GROUPS_WAS_BUMPED',
            {}
          );
          this.bumpedProjects.add(project);
        }
      }
    }
  }

  private async getFixedReleaseGroupBumpType(
    releaseGroupName: string
  ): Promise<SemverBumpType | SemverVersion> {
    const releaseGroup = this.groupGraph.get(releaseGroupName)!.group;
    const releaseGroupFilteredProjects =
      this.releaseGroupToFilteredProjects.get(releaseGroup);
    if (releaseGroupFilteredProjects.size === 0) {
      return 'none';
    }
    const { newVersionInput } = await this.determineVersionBumpForProject(
      releaseGroup,
      // It's a fixed release group, so we can just pick any project in the group
      releaseGroupFilteredProjects.values().next().value
    );
    return newVersionInput;
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
    return this.projectToDependents.get(project) || new Set();
  }

  private getAllNonImplicitDependents(projects: string[]): string[] {
    return projects
      .flatMap((project) => {
        const dependentProjectNames =
          this.getNonImplicitDependentsForProject(project);
        this.tmpCachedDependentProjects.set(project, dependentProjectNames);
        return dependentProjectNames;
      })
      .filter((dep) => !this.allProjectsToProcess.has(dep));
  }

  private getNonImplicitDependentsForProject(project: string): string[] {
    // Use the cached dependents for O(1) lookup instead of O(n) scan
    return Array.from(this.getProjectDependents(project));
  }

  private hasAutoUpdateDependents(projectName: string): boolean {
    return this.projectToUpdateDependentsSetting.get(projectName) === 'auto';
  }

  private topologicallySortReleaseGroups(): string[] {
    // Get all release group names
    const groupNames = Array.from(this.groupGraph.keys());

    // Function to get dependencies of a group
    const getGroupDependencies = (groupName: string): string[] => {
      const groupNode = this.groupGraph.get(groupName);
      if (!groupNode) {
        return [];
      }
      return Array.from(groupNode.dependencies);
    };

    // Perform topological sort
    return topologicalSort(groupNames, getGroupDependencies);
  }

  private topologicallySortProjects(
    releaseGroup: ReleaseGroupWithName
  ): string[] {
    // For fixed relationship groups, the order doesn't matter since all projects will
    // be versioned identically, but we still sort them for consistency
    const projects = releaseGroup.projects.filter((p) =>
      // Only include projects that are in allProjectsToProcess
      this.allProjectsToProcess.has(p)
    );

    // Function to get dependencies of a project that are in the same release group
    const getProjectDependenciesInSameGroup = (project: string): string[] => {
      const deps = this.getProjectDependencies(project);
      // Only include dependencies that are in the same release group and in allProjectsToProcess
      return Array.from(deps).filter(
        (dep) =>
          this.getReleaseGroupNameForProject(dep) === releaseGroup.name &&
          this.allProjectsToProcess.has(dep)
      );
    };

    // Perform topological sort
    return topologicalSort(projects, getProjectDependenciesInSameGroup);
  }

  /**
   * Precompute project -> dependents/dependencies relationships for O(1) lookups
   */
  private async precomputeDependencyRelationships(): Promise<void> {
    for (const projectName of this.allProjectsConfiguredForNxRelease) {
      const versionActions = this.projectsToVersionActions.get(projectName);

      // Create a new set for this project's dependencies
      if (!this.projectToDependencies.has(projectName)) {
        this.projectToDependencies.set(projectName, new Set());
      }

      const deps = await versionActions.readDependencies(
        this.tree,
        this.projectGraph
      );

      for (const dep of deps) {
        // Skip dependencies not covered by nx release
        if (!this.allProjectsConfiguredForNxRelease.has(dep.target)) {
          continue;
        }

        // Add this dependency to the project's dependencies
        this.projectToDependencies.get(projectName)!.add(dep.target);

        // Add this project as a dependent of the target
        if (!this.projectToDependents.has(dep.target)) {
          this.projectToDependents.set(dep.target, new Set());
        }
        this.projectToDependents.get(dep.target)!.add(projectName);
      }
    }
  }

  private getProjectDependencies(project: string): Set<string> {
    return this.projectToDependencies.get(project) || new Set();
  }
}

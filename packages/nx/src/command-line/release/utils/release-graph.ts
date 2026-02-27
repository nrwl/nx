import type {
  NxReleaseDockerConfiguration,
  NxReleaseVersionConfiguration,
} from '../../../config/nx-json';
import type {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import type { Tree } from '../../../generators/tree';
import { filterAffected } from '../../../project-graph/affected/affected-project-graph';
import { calculateFileChanges } from '../../../project-graph/file-utils';
import { NxArgs } from '../../../utils/command-line-utils';
import {
  IMPLICIT_DEFAULT_RELEASE_GROUP,
  type NxReleaseConfig,
} from '../config/config';
import type { ReleaseGroupWithName } from '../config/filter-release-groups';
import { ProjectLogger } from '../version/project-logger';
import { resolveCurrentVersion } from '../version/resolve-current-version';
import { topologicalSort } from '../version/topological-sort';
import {
  NOOP_VERSION_ACTIONS,
  resolveVersionActionsForProject,
  type AfterAllProjectsVersioned,
  type VersionActions,
} from '../version/version-actions';
import {
  getLatestGitTagForPattern,
  GetLatestGitTagForPatternOptions,
  GitCommit,
  sanitizeProjectNameForGitTag,
} from './git';
import { RepoGitTags } from './repository-git-tags';
import { shouldSkipVersionActions, type VersionDataEntry } from './shared';

/**
 * Final configuration for a project after applying release group and project level overrides
 */
export interface FinalConfigForProject {
  specifierSource: NxReleaseVersionConfiguration['specifierSource'];
  currentVersionResolver: NxReleaseVersionConfiguration['currentVersionResolver'];
  currentVersionResolverMetadata: NxReleaseVersionConfiguration['currentVersionResolverMetadata'];
  fallbackCurrentVersionResolver: NxReleaseVersionConfiguration['fallbackCurrentVersionResolver'];
  versionPrefix: NxReleaseVersionConfiguration['versionPrefix'];
  preserveLocalDependencyProtocols: NxReleaseVersionConfiguration['preserveLocalDependencyProtocols'];
  preserveMatchingDependencyRanges: NxReleaseVersionConfiguration['preserveMatchingDependencyRanges'];
  adjustSemverBumpsForZeroMajorVersion: NxReleaseVersionConfiguration['adjustSemverBumpsForZeroMajorVersion'];
  versionActionsOptions: NxReleaseVersionConfiguration['versionActionsOptions'];
  manifestRootsToUpdate: Array<
    Exclude<
      NxReleaseVersionConfiguration['manifestRootsToUpdate'][number],
      string
    >
  >;
  dockerOptions: NxReleaseDockerConfiguration & {
    groupPreVersionCommand?: string;
  };
}

interface GroupNode {
  group: ReleaseGroupWithName;
  dependencies: Set<string>;
  dependents: Set<string>;
}

export interface CreateReleaseGraphOptions {
  tree: Tree;
  projectGraph: ProjectGraph;
  nxReleaseConfig: NxReleaseConfig;
  filters: {
    projects?: string[];
    groups?: string[];
  };
  firstRelease: boolean;
  preid?: string;
  verbose: boolean;
  /**
   * Current version resolution is not needed for publishing, so in cases where the publish subcommand needs to build a release graph,
   * we allow it to skip this step.
   */
  skipVersionResolution?: boolean;
  versionActionsOptionsOverrides?: Record<string, unknown>;
}

export const validReleaseVersionPrefixes = ['auto', '', '~', '^', '='] as const;

/**
 * The complete release graph containing all relationships, caches, and computed data
 * necessary for efficient release operations across versioning, changelog, and publishing.
 *
 * This class encapsulates the complex dependency graph between projects and release groups,
 * providing convenient methods for querying relationships and accessing cached data.
 */
export class ReleaseGraph {
  readonly projectToReleaseGroup = new Map<string, ReleaseGroupWithName>();
  readonly projectToDependents = new Map<string, Set<string>>();
  readonly projectToDependencies = new Map<string, Set<string>>();
  readonly projectToUpdateDependentsSetting = new Map<
    string,
    'auto' | 'always' | 'never'
  >();
  readonly groupGraph = new Map<string, GroupNode>();
  sortedReleaseGroups: string[] = [];
  readonly sortedProjects = new Map<string, string[]>();
  readonly allProjectsConfiguredForNxRelease = new Set<string>();
  allProjectsToProcess = new Set<string>();
  readonly finalConfigsByProject = new Map<string, FinalConfigForProject>();
  readonly projectsToVersionActions = new Map<string, VersionActions>();
  readonly uniqueAfterAllProjectsVersioned = new Map<
    string,
    AfterAllProjectsVersioned
  >();
  readonly projectLoggers = new Map<string, ProjectLogger>();
  readonly cachedCurrentVersions = new Map<string, string | null>();
  readonly cachedLatestMatchingGitTag = new Map<
    string,
    Awaited<ReturnType<typeof getLatestGitTagForPattern>>
  >();
  readonly currentVersionsPerFixedReleaseGroup = new Map<
    string,
    {
      currentVersion: string;
      originatingProjectName: string;
      logText: string;
    }
  >();
  readonly originalDependentProjectsPerProject = new Map<
    string,
    VersionDataEntry['dependentProjects']
  >();
  readonly releaseGroupToFilteredProjects = new Map<
    ReleaseGroupWithName,
    Set<string>
  >();
  private originalFilteredProjects = new Set<string>();

  /**
   * Store the affected graph per commit per project
   * to avoid recomputation of the graph on workspace
   * with multiple projects
   */
  private affectedGraphPerCommit = new Map<string, ProjectGraph>();

  private repositoryGitTags = RepoGitTags.create();

  /**
   * User-friendly log describing what the filter matched.
   * Null if no filters were applied.
   */
  filterLog: { title: string; bodyLines: string[] } | null = null;

  constructor(
    public releaseGroups: ReleaseGroupWithName[],
    public readonly filters: {
      projects?: string[];
      groups?: string[];
    }
  ) {}

  /**
   * Initialize the graph by building all relationships and caches
   * @internal - Called by createReleaseGraph(), not meant for external use
   */
  async init(options: CreateReleaseGraphOptions): Promise<void> {
    // Step 1: Setup project to release group mapping
    this.setupProjectReleaseGroupMapping();

    // Step 2: Apply initial filtering to determine base set of projects and groups to process
    this.applyInitialFiltering();

    // Step 3: Setup projects to process and resolve version actions
    await this.setupProjectsToProcess(options);

    // Step 4: Precompute dependency relationships
    await this.precomputeDependencyRelationships(
      options.tree,
      options.projectGraph
    );

    // Step 5: Apply dependency-aware filtering based on updateDependents
    this.applyDependencyAwareFiltering();

    // Step 5: Build the group graph structure
    this.buildGroupGraphStructure();

    // Step 6: Resolve current versions for all projects to process (unless explicitly skipped)
    if (!options.skipVersionResolution) {
      await this.resolveCurrentVersionsForProjects(
        options.tree,
        options.projectGraph,
        options.preid ?? ''
      );
    }

    // Step 7: Build dependency relationships between groups
    this.buildGroupDependencyGraph();

    // Step 8: Topologically sort groups and projects
    this.sortedReleaseGroups = this.topologicallySortReleaseGroups();
    for (const group of this.releaseGroups) {
      this.sortedProjects.set(
        group.name,
        this.topologicallySortProjects(group)
      );
    }

    // Step 9: Populate dependent projects data
    await this.populateDependentProjectsData(
      options.tree,
      options.projectGraph
    );
  }

  /**
   * Setup mapping from project to release group and cache updateDependents settings
   */
  private setupProjectReleaseGroupMapping(): void {
    for (const group of this.releaseGroups) {
      for (const project of group.projects) {
        this.projectToReleaseGroup.set(project, group);

        const updateDependents =
          (group.version as NxReleaseVersionConfiguration)?.updateDependents ||
          'always';
        this.projectToUpdateDependentsSetting.set(project, updateDependents);
      }
    }
  }

  /**
   * Apply initial filtering to construct releaseGroupToFilteredProjects based on filters.
   * This determines the base set of projects and groups before considering dependencies.
   */
  private applyInitialFiltering(): void {
    const matchedReleaseGroups: ReleaseGroupWithName[] = [];

    for (const releaseGroup of this.releaseGroups) {
      // If group filter is applied and this group doesn't match, skip it entirely
      if (
        this.filters.groups?.length &&
        !this.filters.groups.includes(releaseGroup.name)
      ) {
        continue;
      }

      // If filtering by groups (not projects), include ALL projects in the matched group
      if (this.filters.groups?.length && !this.filters.projects?.length) {
        this.releaseGroupToFilteredProjects.set(
          releaseGroup,
          new Set(releaseGroup.projects)
        );
        matchedReleaseGroups.push(releaseGroup);
        continue;
      }

      // If filtering by projects, filter down to matching projects
      const filteredProjects = new Set<string>();
      for (const project of releaseGroup.projects) {
        if (
          this.filters.projects?.length &&
          !this.filters.projects.includes(project)
        ) {
          continue;
        }
        filteredProjects.add(project);
      }

      // If no filters applied or group has matching projects, include it
      if (filteredProjects.size > 0 || !this.hasAnyFilters()) {
        const projectsToInclude =
          filteredProjects.size > 0
            ? filteredProjects
            : new Set(releaseGroup.projects);
        this.releaseGroupToFilteredProjects.set(
          releaseGroup,
          projectsToInclude
        );
        matchedReleaseGroups.push(releaseGroup);
      }
    }

    // Update this.releaseGroups to only include matched groups
    if (this.hasAnyFilters()) {
      this.releaseGroups = matchedReleaseGroups;
    }
  }

  /**
   * Check if any filters are applied
   */
  private hasAnyFilters(): boolean {
    return !!(this.filters.projects?.length || this.filters.groups?.length);
  }

  /**
   * Setup projects to process and resolve version actions
   */
  private async setupProjectsToProcess(
    options: CreateReleaseGraphOptions
  ): Promise<void> {
    const {
      tree,
      projectGraph,
      nxReleaseConfig,
      filters,
      firstRelease,
      versionActionsOptionsOverrides,
    } = options;
    let projectsToProcess = new Set<string>();
    const resolveVersionActionsForProjectCallbacks = [];

    // Precompute all projects in nx release config
    for (const [groupName, group] of Object.entries(nxReleaseConfig.groups)) {
      for (const project of group.projects) {
        this.allProjectsConfiguredForNxRelease.add(project);
        this.projectLoggers.set(project, new ProjectLogger(project));

        if (filters.groups?.includes(groupName)) {
          projectsToProcess.add(project);
        } else if (filters.projects?.includes(project)) {
          projectsToProcess.add(project);
        }

        const projectGraphNode = projectGraph.nodes[project];

        const releaseGroup = this.projectToReleaseGroup.get(project);

        const finalConfigForProject = ReleaseGraph.resolveFinalConfigForProject(
          releaseGroup,
          projectGraphNode,
          firstRelease,
          versionActionsOptionsOverrides
        );
        this.finalConfigsByProject.set(project, finalConfigForProject);

        resolveVersionActionsForProjectCallbacks.push(async () => {
          const {
            versionActionsPath,
            versionActions,
            afterAllProjectsVersioned,
          } = await resolveVersionActionsForProject(
            tree,
            releaseGroup,
            projectGraphNode,
            finalConfigForProject
          );
          if (!this.uniqueAfterAllProjectsVersioned.has(versionActionsPath)) {
            this.uniqueAfterAllProjectsVersioned.set(
              versionActionsPath,
              afterAllProjectsVersioned
            );
          }
          let versionActionsToUse = versionActions;
          const shouldSkip = shouldSkipVersionActions(
            finalConfigForProject.dockerOptions,
            project
          );

          if (shouldSkip) {
            versionActionsToUse = new NOOP_VERSION_ACTIONS(
              releaseGroup,
              projectGraphNode,
              finalConfigForProject
            );
          }
          this.projectsToVersionActions.set(project, versionActionsToUse);
        });
      }
    }

    if (!filters.groups?.length && !filters.projects?.length) {
      projectsToProcess = this.allProjectsConfiguredForNxRelease;
    }

    if (projectsToProcess.size === 0) {
      throw new Error(
        'No projects are set to be processed, please report this as a bug on https://github.com/nrwl/nx/issues'
      );
    }

    this.allProjectsToProcess = new Set(projectsToProcess);

    for (const cb of resolveVersionActionsForProjectCallbacks) {
      await cb();
    }
  }

  /**
   * Precompute dependency relationships between all projects
   */
  private async precomputeDependencyRelationships(
    tree: Tree,
    projectGraph: ProjectGraph
  ): Promise<void> {
    for (const projectName of this.allProjectsConfiguredForNxRelease) {
      const versionActions = this.projectsToVersionActions.get(projectName);

      if (!this.projectToDependencies.has(projectName)) {
        this.projectToDependencies.set(projectName, new Set());
      }

      const deps = await versionActions.readDependencies(tree, projectGraph);

      for (const dep of deps) {
        if (!this.allProjectsConfiguredForNxRelease.has(dep.target)) {
          continue;
        }

        this.projectToDependencies.get(projectName)!.add(dep.target);

        if (!this.projectToDependents.has(dep.target)) {
          this.projectToDependents.set(dep.target, new Set());
        }
        this.projectToDependents.get(dep.target)!.add(projectName);
      }
    }
  }

  /**
   * Apply dependency-aware filtering that considers updateDependents configuration.
   * This includes transitive dependents based on updateDependents setting ('always' by default, or 'auto').
   */
  private applyDependencyAwareFiltering(): void {
    // Track the original filtered projects before adding dependents
    this.originalFilteredProjects = new Set(this.allProjectsToProcess);

    if (!this.hasAnyFilters()) {
      // No filtering applied, nothing to do
      return;
    }

    // Validate filtering against fixed release groups
    this.validateFilterAgainstFixedGroups();

    // Find all dependents that need to be included based on updateDependents setting
    this.findDependentsToProcess();

    // Generate user-friendly filter log
    this.generateFilterLog();
  }

  /**
   * Validate that the filter doesn't try to isolate projects in fixed release groups
   */
  private validateFilterAgainstFixedGroups(): void {
    if (!this.filters.projects?.length) {
      // Group filtering doesn't have this issue
      return;
    }

    for (const releaseGroup of this.releaseGroups) {
      if (releaseGroup.projectsRelationship !== 'fixed') {
        continue;
      }

      const filteredProjectsInGroup = releaseGroup.projects.filter((p) =>
        this.releaseGroupToFilteredProjects.get(releaseGroup)?.has(p)
      );

      if (
        filteredProjectsInGroup.length > 0 &&
        filteredProjectsInGroup.length < releaseGroup.projects.length
      ) {
        throw new Error(
          `Cannot filter to a subset of projects within fixed release group "${releaseGroup.name}". ` +
            `Filtered projects: [${filteredProjectsInGroup.join(', ')}], ` +
            `All projects in group: [${releaseGroup.projects.join(', ')}]. ` +
            `Either filter to all projects in the group, use --groups to filter by group, or change the group to "independent".`
        );
      }
    }
  }

  /**
   * Find dependents that should be included in processing based on updateDependents configuration
   */
  private findDependentsToProcess(): void {
    const projectsToProcess = Array.from(this.allProjectsToProcess);
    const allTrackedDependents = new Set<string>();
    const dependentsToProcess = new Set<string>();
    const additionalGroups = new Map<string, ReleaseGroupWithName>();

    // BFS traversal to find all transitive dependents
    let currentLevel = [...projectsToProcess];

    while (currentLevel.length > 0) {
      const nextLevel: string[] = [];

      const dependents = this.getAllNonImplicitDependents(currentLevel);

      for (const dep of dependents) {
        if (
          allTrackedDependents.has(dep) ||
          this.allProjectsToProcess.has(dep)
        ) {
          continue;
        }

        allTrackedDependents.add(dep);

        // Check if this dependent should be included based on updateDependents settings
        const depUpdateDependentsSetting =
          this.projectToUpdateDependentsSetting.get(dep);

        // Only include if dependent has 'always' or 'auto' (not 'never')
        if (depUpdateDependentsSetting !== 'never') {
          // Find which project(s) in currentLevel this dependent depends on
          const shouldIncludeDependent = currentLevel.some((proj) => {
            const projUpdateSetting =
              this.projectToUpdateDependentsSetting.get(proj);
            const projDependents = this.getProjectDependents(proj);

            if (!projDependents.has(dep)) {
              return false;
            }

            // Always include if updateDependents is 'always'
            if (projUpdateSetting === 'always') {
              return true;
            }

            // For 'auto', include if in the same release group to match historical behavior
            if (projUpdateSetting === 'auto') {
              const projGroup = this.getReleaseGroupForProject(proj);
              const depGroup = this.getReleaseGroupForProject(dep);
              return projGroup && depGroup && projGroup.name === depGroup.name;
            }

            return false;
          });

          if (shouldIncludeDependent) {
            dependentsToProcess.add(dep);

            // Track the release group of this dependent
            const depGroup = this.getReleaseGroupForProject(dep);
            if (depGroup) {
              // Check if this group is already in our list by name
              const groupAlreadyExists = this.releaseGroups.some(
                (g) => g.name === depGroup.name
              );
              if (!groupAlreadyExists) {
                additionalGroups.set(depGroup.name, depGroup);
              }
            }
          }
        }

        nextLevel.push(dep);
      }

      currentLevel = nextLevel;
    }

    dependentsToProcess.forEach((dep) => this.allProjectsToProcess.add(dep));

    // Add any additional groups and their filtered projects
    additionalGroups.forEach((group) => {
      // When adding groups due to dependents, clear version plans to avoid duplication
      // Version plans should only be processed for groups that were explicitly included
      const groupForDependents = {
        ...group,
        versionPlans: false,
        resolvedVersionPlans: false,
      } as const;
      this.releaseGroups.push(groupForDependents);
      // Add the projects from this group that are actually being processed
      const projectsInGroup = new Set(
        group.projects.filter((p) => dependentsToProcess.has(p))
      );
      this.releaseGroupToFilteredProjects.set(
        groupForDependents,
        projectsInGroup
      );
    });
  }

  /**
   * Generate user-friendly log describing what the filter matched
   */
  private generateFilterLog(): void {
    if (this.filters.projects?.length) {
      // Projects filter - only show the originally filtered projects to match old behavior
      const matchedProjects = Array.from(this.originalFilteredProjects);
      this.filterLog = {
        title: `Your filter "${this.filters.projects.join(
          ','
        )}" matched the following projects:`,
        bodyLines: matchedProjects.map((p) => {
          const releaseGroupForProject = this.projectToReleaseGroup.get(p);
          if (
            !releaseGroupForProject ||
            releaseGroupForProject.name === IMPLICIT_DEFAULT_RELEASE_GROUP
          ) {
            return `- ${p}`;
          }
          return `- ${p} (release group "${releaseGroupForProject.name}")`;
        }),
      };
    }
    // TODO: add groups filter log
  }

  /**
   * Build the group graph structure
   */
  private buildGroupGraphStructure(): void {
    for (const group of this.releaseGroups) {
      // Don't overwrite if already exists (may have been added during filtering)
      if (!this.groupGraph.has(group.name)) {
        this.groupGraph.set(group.name, {
          group,
          dependencies: new Set(),
          dependents: new Set(),
        });
      }
    }
  }

  /**
   * Resolve current versions for all projects that will be processed
   */
  private async resolveCurrentVersionsForProjects(
    tree: Tree,
    projectGraph: ProjectGraph,
    preid: string
  ): Promise<void> {
    for (const [, releaseGroupNode] of this.groupGraph) {
      for (const projectName of releaseGroupNode.group.projects) {
        const projectGraphNode = projectGraph.nodes[projectName];

        if (!this.allProjectsToProcess.has(projectName)) {
          continue;
        }

        const versionActions = this.projectsToVersionActions.get(projectName)!;
        const finalConfigForProject =
          this.finalConfigsByProject.get(projectName)!;

        let latestMatchingGitTag:
          | Awaited<ReturnType<typeof getLatestGitTagForPattern>>
          | undefined;
        const releaseTagPattern = releaseGroupNode.group.releaseTag.pattern;

        if (finalConfigForProject.currentVersionResolver === 'git-tag') {
          latestMatchingGitTag = await getLatestGitTagForPattern(
            releaseTagPattern,
            {
              projectName: sanitizeProjectNameForGitTag(projectGraphNode.name),
              releaseGroupName: releaseGroupNode.group.name,
            },
            this.resolveRepositoryTags.bind(this),
            {
              checkAllBranchesWhen:
                releaseGroupNode.group.releaseTag.checkAllBranchesWhen,
              preid: preid,
              requireSemver: releaseGroupNode.group.releaseTag.requireSemver,
              strictPreid: releaseGroupNode.group.releaseTag.strictPreid,
            }
          );
          this.cachedLatestMatchingGitTag.set(
            projectName,
            latestMatchingGitTag
          );
        }

        const currentVersion = await resolveCurrentVersion(
          tree,
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
    }
  }

  /**
   * Build dependency relationships between release groups
   */
  private buildGroupDependencyGraph(): void {
    for (const [releaseGroupName, releaseGroupNode] of this.groupGraph) {
      for (const projectName of releaseGroupNode.group.projects) {
        const projectDeps = this.getProjectDependencies(projectName);
        for (const dep of projectDeps) {
          const dependencyGroup = this.getReleaseGroupNameForProject(dep);
          if (dependencyGroup && dependencyGroup !== releaseGroupName) {
            releaseGroupNode.dependencies.add(dependencyGroup);

            // Only add to dependents if the dependency group exists in the graph
            // (it may have been filtered out due to user filters)
            const dependencyGroupNode = this.groupGraph.get(dependencyGroup);
            if (dependencyGroupNode) {
              dependencyGroupNode.dependents.add(releaseGroupName);
            }
          }
        }
      }
    }
  }

  /**
   * Topologically sort release groups
   */
  private topologicallySortReleaseGroups(): string[] {
    const groupNames = Array.from(this.groupGraph.keys());

    const getGroupDependencies = (groupName: string): string[] => {
      const groupNode = this.groupGraph.get(groupName);
      if (!groupNode) {
        return [];
      }
      return Array.from(groupNode.dependencies);
    };

    return topologicalSort(groupNames, getGroupDependencies);
  }

  /**
   * Topologically sort projects within a release group
   */
  private topologicallySortProjects(
    releaseGroup: ReleaseGroupWithName
  ): string[] {
    const projects = releaseGroup.projects.filter((p) =>
      this.allProjectsToProcess.has(p)
    );

    const getProjectDependenciesInSameGroup = (project: string): string[] => {
      const deps = this.getProjectDependencies(project);
      return Array.from(deps).filter(
        (dep) =>
          this.getReleaseGroupNameForProject(dep) === releaseGroup.name &&
          this.allProjectsToProcess.has(dep)
      );
    };

    return topologicalSort(projects, getProjectDependenciesInSameGroup);
  }

  private async populateDependentProjectsData(
    tree: Tree,
    projectGraph: ProjectGraph
  ): Promise<void> {
    // Populate detailed dependent projects data for all projects being processed
    for (const projectName of this.allProjectsToProcess) {
      const dependentProjectNames = Array.from(
        this.getProjectDependents(projectName)
      ).filter((dep) => this.allProjectsConfiguredForNxRelease.has(dep));

      const dependentProjectsData: VersionDataEntry['dependentProjects'] = [];

      for (const dependentProjectName of dependentProjectNames) {
        const versionActions =
          this.projectsToVersionActions.get(dependentProjectName)!;
        const { currentVersion, dependencyCollection } =
          await versionActions.readCurrentVersionOfDependency(
            tree,
            projectGraph,
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

  /**
   * Get all non-implicit dependents for a set of projects
   */
  private getAllNonImplicitDependents(projects: string[]): string[] {
    return projects
      .flatMap((project) => Array.from(this.getProjectDependents(project)))
      .filter((dep) => !this.allProjectsToProcess.has(dep));
  }

  /**
   * Resolve final configuration for a project
   *
   * NOTE: We are providing ultimate fallback values via ?? here mainly just to keep TypeScript happy.
   * All default values should have been applied by this point by config.ts but the types can't know
   * that for sure at this point.
   */
  private static resolveFinalConfigForProject(
    releaseGroup: ReleaseGroupWithName,
    projectGraphNode: ProjectGraphProjectNode,
    firstRelease: boolean,
    versionActionsOptionsOverrides?: Record<string, unknown>
  ): FinalConfigForProject {
    const releaseGroupVersionConfig = releaseGroup.version as
      | NxReleaseVersionConfiguration
      | undefined;
    const projectVersionConfig = projectGraphNode.data.release?.version as
      | NxReleaseVersionConfiguration
      | undefined;
    const projectDockerConfig = projectGraphNode.data.release?.docker;

    /**
     * specifierSource
     *
     * If the user has provided a specifier, it always takes precedence,
     * so the effective specifier source is 'prompt', regardless of what
     * the project or release group config says.
     */
    const specifierSource =
      projectVersionConfig?.specifierSource ??
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
     * Merge docker options configured in project with release group config,
     * project level configuration should take precedence
     */
    const dockerOptions: NxReleaseDockerConfiguration & {
      groupPreVersionCommand?: string;
    } = Object.assign(
      {},
      releaseGroup.docker || {},
      projectDockerConfig || {}
    ) as NxReleaseDockerConfiguration & {
      groupPreVersionCommand?: string;
    };

    /**
     * currentVersionResolver, defaults to disk
     */
    let currentVersionResolver =
      projectVersionConfig?.currentVersionResolver ??
      releaseGroupVersionConfig?.currentVersionResolver ??
      'disk';

    // Check if this project should skip version actions based on docker configuration
    const shouldSkip = shouldSkipVersionActions(
      dockerOptions,
      projectGraphNode.name
    );

    if (shouldSkip) {
      // If the project skips version actions, it doesn't need to resolve a current version
      currentVersionResolver = 'none';
    } else if (
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
     * preserveMatchingDependencyRanges
     *
     * This was false by default until v22, but is true by default now.
     */
    const preserveMatchingDependencyRanges =
      projectVersionConfig?.preserveMatchingDependencyRanges ??
      releaseGroupVersionConfig?.preserveMatchingDependencyRanges ??
      true;

    /**
     * adjustSemverBumpsForZeroMajorVersion
     *
     * TODO(v23): change the default value of this to true
     * This is false by default for backward compatibility.
     */
    const adjustSemverBumpsForZeroMajorVersion =
      projectVersionConfig?.adjustSemverBumpsForZeroMajorVersion ??
      releaseGroupVersionConfig?.adjustSemverBumpsForZeroMajorVersion ??
      false;

    /**
     * fallbackCurrentVersionResolver, defaults to disk when performing a first release, otherwise undefined
     */
    const fallbackCurrentVersionResolver =
      projectVersionConfig?.fallbackCurrentVersionResolver ??
      releaseGroupVersionConfig?.fallbackCurrentVersionResolver ??
      (firstRelease ? 'disk' : undefined);

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
      ...(versionActionsOptionsOverrides ?? {}),
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
      preserveMatchingDependencyRanges,
      adjustSemverBumpsForZeroMajorVersion,
      versionActionsOptions,
      manifestRootsToUpdate,
      dockerOptions,
    };
  }

  /**
   * Get the release group for a given project
   */
  getReleaseGroupForProject(
    projectName: string
  ): ReleaseGroupWithName | undefined {
    return this.projectToReleaseGroup.get(projectName);
  }

  /**
   * Get the release group name for a given project
   */
  getReleaseGroupNameForProject(projectName: string): string | null {
    const group = this.projectToReleaseGroup.get(projectName);
    return group ? group.name : null;
  }

  /**
   * Get the dependencies of a project
   */
  getProjectDependencies(projectName: string): Set<string> {
    return this.projectToDependencies.get(projectName) || new Set();
  }

  /**
   * Get the dependents of a project (projects that depend on it)
   */
  getProjectDependents(projectName: string): Set<string> {
    return this.projectToDependents.get(projectName) || new Set();
  }

  /**
   * Get the version actions for a project
   */
  getVersionActionsForProject(projectName: string): VersionActions | undefined {
    return this.projectsToVersionActions.get(projectName);
  }

  /**
   * Check if a project will be processed
   */
  isProjectToProcess(projectName: string): boolean {
    return this.allProjectsToProcess.has(projectName);
  }

  async resolveAffectedFilesPerCommitInProjectGraph(
    commit: GitCommit,
    projectGraph: ProjectGraph
  ) {
    // Try to get the graph associated with the commit shortHash
    // if not available, calculate it and store it in the cache
    const { shortHash } = commit;
    let affectedGraph = this.affectedGraphPerCommit.get(shortHash);

    if (affectedGraph) {
      return affectedGraph;
    }

    // Convert affectedFiles to FileChange[] format with proper diff computation
    const touchedFiles = calculateFileChanges(commit.affectedFiles, {
      base: `${commit.shortHash}^`,
      head: commit.shortHash,
    } as NxArgs);

    // Use the same affected detection logic as `nx affected`
    affectedGraph = await filterAffected(projectGraph, touchedFiles);
    this.affectedGraphPerCommit.set(shortHash, affectedGraph);

    return affectedGraph;
  }

  async resolveRepositoryTags(
    resolveTagsWhen: GetLatestGitTagForPatternOptions['checkAllBranchesWhen']
  ) {
    return this.repositoryGitTags.resolveTags(resolveTagsWhen);
  }

  /**
   * Runs validation on resolved VersionActions instances. E.g. check that manifest files exist for all projects that will be processed.
   * This should be called after preVersionCommand has run, as those commands may create manifest files that are needed for versioning.
   */
  async validate(tree: Tree): Promise<void> {
    const validationPromises: Promise<void>[] = [];

    for (const projectName of this.allProjectsToProcess) {
      const versionActions = this.projectsToVersionActions.get(projectName);
      if (versionActions) {
        validationPromises.push(versionActions.validate(tree));
      }
    }

    // Validate in parallel
    await Promise.all(validationPromises);
  }
}

/**
 * Creates a complete release graph by analyzing all release groups, projects, and their relationships.
 *
 * This function builds the graph structure, applies filtering logic that considers dependencies
 * and updateDependents configuration, and caches all necessary data.
 *
 * The returned graph can be reused across versioning, changelog, and publishing operations.
 */
export async function createReleaseGraph(
  options: CreateReleaseGraphOptions
): Promise<ReleaseGraph> {
  // Construct ReleaseGroupWithName objects from nxReleaseConfig
  const releaseGroups: ReleaseGroupWithName[] = Object.entries(
    options.nxReleaseConfig.groups
  ).map(([name, group]) => {
    return {
      ...group,
      name,
      resolvedVersionPlans: group.versionPlans ? [] : false,
    };
  });

  const graph = new ReleaseGraph(releaseGroups, options.filters);
  await graph.init(options);

  return graph;
}

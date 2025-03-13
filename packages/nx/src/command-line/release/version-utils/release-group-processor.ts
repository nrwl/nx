import { prerelease } from 'semver';
import { ProjectGraph } from '../../../config/project-graph';
import { Tree } from '../../../generators/tree';
import { interpolate } from '../../../tasks-runner/utils';
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
  validReleaseVersionPrefixes,
} from '../version';
import { deriveSpecifierFromConventionalCommits } from './derive-specifier-from-conventional-commits';
import { deriveSpecifierFromVersionPlan } from './deriver-specifier-from-version-plans';
import {
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

// TODO: Check this old TODO is still accurate :D
// TODO: updateDependents of never is maybe not named intuitively. Currently the dep is bumped in the relevant manifest, it's just the version of the manifest that isn't.
// Does "never" really suggest it should be doing nothing at all to dependents? Probably... Maybe we need a third mode...

export interface VersionData {
  currentVersion: string;
  /**
   * newVersion will be null in the case that no changes are detected for the project,
   * e.g. when using conventional commits
   */
  newVersion: string | null;
  /**
   * The list of projects which depend upon the current project.
   */
  dependentProjects: {
    source: string;
    target: string;
    type: string;
    dependencyCollection: string;
    rawVersionSpec: string;
  }[];
}

// Any semver version string such as "1.2.3" or "1.2.3-beta.1"
type SemverVersion = string;

// TODO: add more interpolated data for richer logging (versionPlan is the only one currently)
const BUMP_TYPE_REASON_TEXT = {
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
  fallbackCurrentVersionResolver?: 'disk';
  userGivenSpecifier?: SemverBumpType;
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
}

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
  private versionData: Map<
    string, // project name
    VersionData
  > = new Map();
  private projectsToProcess: Set<string>;
  private allProjectsToProcess: Set<string>;
  private userGivenSpecifier: string | undefined;
  private cachedCurrentVersions: Map<
    string, // project name
    string // current version
  > = new Map();
  private cachedLatestMatchingGitTag: Map<
    string, // project name
    Awaited<ReturnType<typeof getLatestGitTagForPattern>>
  > = new Map();
  private tmpCachedDependentProjects: Map<
    string, // project name
    string[] // dependent project names
  > = new Map();
  /**
   * Resolve the data regarding dependent projects for each project upfront so that it remains accurate
   * even after updates are applied to manifests.
   */
  private cachedDependentProjects: Map<
    string, // project name
    VersionData['dependentProjects']
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
    private releaseGroupToFilteredProjects: Map<
      ReleaseGroupWithName,
      Set<string>
    >,
    private options: ReleaseGroupProcessorOptions
  ) {
    // Strip any leading "v" from the user given specifier, if it exists
    this.userGivenSpecifier = options.userGivenSpecifier?.replace(/^v/, '');

    // TODO: Is supporting this at the top level actually enough? Do we need to support it everywhere we support generatorOptions?
    this.updateDependents =
      (this.nxReleaseConfig.version?.generatorOptions?.updateDependents as
        | 'auto'
        | 'never') || 'auto';
    this.projectsToProcess = new Set(
      this.options.filters.projects || Object.keys(this.projectGraph.nodes)
    );

    this.allProjectsToProcess = new Set(this.projectsToProcess);
    const projectsToProcess = Array.from(this.projectsToProcess);
    let dependents = this.getAllNonImplicitDependents(projectsToProcess);
    while (dependents.length > 0) {
      // Only add the dependents to allProjectsToProcess if updateDependents is set to auto
      if (this.updateDependents === 'auto') {
        dependents.forEach((dep) => this.allProjectsToProcess.add(dep));
      }
      dependents = this.getAllNonImplicitDependents(dependents);
    }
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

  // TODO: Figure out the story for implicit dependencies and `nx release`, there is a bit of a mixture of project graph and manifest concerns right now
  private getNonImplicitDependentsForProject(project: string): string[] {
    return Object.entries(this.projectGraph.dependencies)
      .filter(([_, deps]) =>
        deps.some((dep) => dep.target === project && dep.type !== 'implicit')
      )
      .map(([projectName]) => projectName);
  }

  async buildGroupGraph(): Promise<void> {
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
        const projectGraphNode = this.projectGraph.nodes[projectName];

        // Resolve the appropriate ManifestActions instance for the project
        if (!this.projectsToManifestActions.has(projectName)) {
          // TODO: should prefix handling actually move to the manifest actions? Some prefixes are likely ecosystem specific...
          const versionPrefix = (projectGraphNode.data.release?.version
            ?.generatorOptions?.versionPrefix ||
            releaseGroupNode.group.version?.generatorOptions?.versionPrefix) as
            | ReleaseVersionGeneratorSchema['versionPrefix']
            | undefined;
          if (
            versionPrefix &&
            !validReleaseVersionPrefixes.includes(versionPrefix)
          ) {
            throw new Error(
              `Invalid value for versionPrefix: "${versionPrefix}"

Valid values are: ${validReleaseVersionPrefixes
                .map((s) => `"${s}"`)
                .join(', ')}`
            );
          }

          const manifestRootsToUpdate = [];
          /**
           * TODO: Move away from this legacy config option of packageRoot and support multiple
           * manifest roots to update.
           */
          const customPackageRoot =
            projectGraphNode.data.release?.version?.generatorOptions
              ?.packageRoot ||
            this.nxReleaseConfig.version?.generatorOptions?.packageRoot;
          if (customPackageRoot) {
            manifestRootsToUpdate.push(customPackageRoot);
          }

          const { manifestActionsPath, ManifestActionsClass, manifestActions } =
            await resolveManifestActionsForProject(
              this.tree,
              releaseGroupNode.group,
              projectGraphNode,
              manifestRootsToUpdate
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

          // Check if the project has been filtered out of explicit versioning before continuing any further
          if (!this.allProjectsToProcess.has(projectName)) {
            continue;
          }

          let latestMatchingGitTag:
            | Awaited<ReturnType<typeof getLatestGitTagForPattern>>
            | undefined;
          const releaseTagPattern = releaseGroupNode.group.releaseTagPattern;
          // Cache the last matching git tag for relevant projects
          const currentVersionResolver =
            projectGraphNode.data.release?.version?.generatorOptions
              ?.currentVersionResolver ||
            releaseGroupNode.group.version?.generatorOptions
              ?.currentVersionResolver;
          if (currentVersionResolver === 'git-tag') {
            latestMatchingGitTag = await getLatestGitTagForPattern(
              releaseTagPattern,
              {
                projectName: projectGraphNode.name,
              },
              releaseGroupNode.group.releaseTagPatternCheckAllBranchesWhen
            );
            this.cachedLatestMatchingGitTag.set(
              projectName,
              latestMatchingGitTag
            );
          }

          let specifierSource: ReleaseVersionGeneratorSchema['specifierSource'] =
            'prompt';
          const specifierSourceFromConfig = (projectGraphNode.data.release
            ?.version?.generatorOptions?.specifierSource ||
            releaseGroupNode.group.version?.generatorOptions
              ?.specifierSource) as
            | ReleaseVersionGeneratorSchema['specifierSource']
            | undefined;
          // The user is forcibly overriding whatever specifierSource they had otherwise set by imperatively providing a specifier
          if (this.userGivenSpecifier) {
            specifierSource = 'prompt';
          } else if (specifierSourceFromConfig) {
            specifierSource = specifierSourceFromConfig;
          }

          // Cache the current version for the project
          const currentVersion = await resolveCurrentVersion(
            this.tree,
            projectGraphNode,
            releaseGroupNode.group,
            manifestActions,
            projectLogger,
            this.options.firstRelease,
            this.cachedCurrentVersionsPerFixedReleaseGroup,
            specifierSource,
            releaseTagPattern,
            latestMatchingGitTag,
            this.options.fallbackCurrentVersionResolver
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

    // Populate the full data for the cached dependent projects now that all manifest actions are available
    for (const [projectName, dependentProjectNames] of this
      .tmpCachedDependentProjects) {
      const dependentProjectsData: VersionData['dependentProjects'] = [];
      for (const dependentProjectName of dependentProjectNames) {
        const manifestActions =
          this.getManifestActionsForProject(dependentProjectName);
        const { currentVersion, dependencyCollection } =
          await manifestActions.getCurrentVersionOfDependency(
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
      this.cachedDependentProjects.set(projectName, dependentProjectsData);
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

  flushAllProjectLoggers() {
    for (const projectLogger of this.projectLoggers.values()) {
      projectLogger.flush();
    }
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
              dryRun: this.options.dryRun,
              verbose: this.options.verbose,
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
    const { bumpType, bumpTypeReason, bumpTypeReasonData } =
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
        for (const project of releaseGroup.projects) {
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
            dependentProjects: this.getCachedDependentProjects(project),
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
      bumpTypeReason,
      bumpTypeReasonData
    );

    // First, update versions for all projects in the fixed group
    for (let i = 0; i < releaseGroup.projects.length; i++) {
      const project = releaseGroup.projects[i];
      const manifestActions = this.getManifestActionsForProject(project);
      const projectLogger = this.getProjectLoggerForProject(project);
      const currentVersion = this.getCurrentCachedVersionForProject(project);

      // The first project's version was determined above, so this log is only appropriate for the remaining projects
      if (i > 0) {
        projectLogger.buffer(
          `❓ Applied version ${newVersion} directly, because the project is a member of a fixed release group containing ${firstProject}`
        );
      }

      // Write the new version to the configured manifests to update
      await manifestActions.writeVersionToManifests(this.tree, newVersion);
      for (const manifestPath of manifestActions.manifestsToUpdate) {
        projectLogger.buffer(
          `✍️  New version ${newVersion} written to manifest: ${manifestPath}`
        );
      }
      this.bumpedProjects.add(project);
      bumped = true;

      // Populate version data for each project
      this.versionData.set(project, {
        currentVersion,
        newVersion,
        dependentProjects: this.getCachedDependentProjects(project),
      });
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
      const { bumpType, bumpTypeReason, bumpTypeReasonData } =
        await this.determineVersionBumpForProject(releaseGroup, project);
      projectBumpTypes.set(project, {
        bumpType,
        bumpTypeReason,
        bumpTypeReasonData,
      });
      if (bumpType !== 'none') {
        projectsToUpdate.add(project);
      }
    }

    // Second pass: Update versions
    for (const project of releaseGroupFilteredProjects) {
      if (projectsToUpdate.has(project)) {
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

    // Third pass: Update dependencies
    for (const project of releaseGroupFilteredProjects) {
      if (projectsToUpdate.has(project)) {
        await this.updateDependenciesForProject(project);
      }
    }

    return bumped;
  }

  private async determineVersionBumpForProject(
    releaseGroup: ReleaseGroupWithName,
    projectName: string
  ): Promise<{
    bumpType: SemverBumpType | SemverVersion;
    bumpTypeReason: keyof typeof BUMP_TYPE_REASON_TEXT;
    bumpTypeReasonData: Record<string, unknown>;
  }> {
    // User given specifier has the highest precedence
    if (this.userGivenSpecifier) {
      return {
        bumpType: this.userGivenSpecifier as SemverBumpType,
        bumpTypeReason: 'USER_SPECIFIER',
        bumpTypeReasonData: {},
      };
    }

    const projectGraphNode = this.projectGraph.nodes[projectName];
    const projectLogger = this.getProjectLoggerForProject(projectName);

    // Resolve the semver relative bump via conventional-commits
    const specifierSourceFromConfig =
      projectGraphNode.data.release?.version?.generatorOptions
        ?.specifierSource ||
      (releaseGroup.version?.generatorOptions?.specifierSource as
        | ReleaseVersionGeneratorSchema['specifierSource']
        | undefined);
    if (specifierSourceFromConfig === 'conventional-commits') {
      const currentVersion =
        this.getCurrentCachedVersionForProject(projectName);
      const bumpType = await deriveSpecifierFromConventionalCommits(
        this.nxReleaseConfig,
        this.projectGraph,
        projectLogger,
        releaseGroup,
        projectGraphNode,
        !!prerelease(currentVersion ?? ''),
        this.cachedLatestMatchingGitTag.get(projectName),
        this.options.fallbackCurrentVersionResolver,
        this.options.preid
      );
      return {
        bumpType,
        bumpTypeReason: 'CONVENTIONAL_COMMITS',
        bumpTypeReasonData: {},
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
      // TODO: handle deleting version plans after versioning here
      return {
        bumpType,
        bumpTypeReason: 'VERSION_PLANS',
        bumpTypeReasonData: {
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
    if (specifierSourceFromConfig === 'prompt') {
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
        bumpTypeReasonData: {},
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
    bumpTypeReason: keyof typeof BUMP_TYPE_REASON_TEXT,
    bumpTypeReasonData: Record<string, unknown>
  ): Promise<{ currentVersion: string; newVersion: string }> {
    const currentVersion = this.getCurrentCachedVersionForProject(project);
    const projectLogger = this.getProjectLoggerForProject(project);
    const newVersion = deriveNewSemverVersion(
      currentVersion,
      bumpType,
      this.options.preid
    );
    const bumpTypeReasonText = BUMP_TYPE_REASON_TEXT[bumpTypeReason];
    if (!bumpTypeReasonText) {
      throw new Error(
        `Unhandled bump type reason for ${project} with bump type ${bumpType} and bump type reason ${bumpTypeReason}`
      );
    }
    const interpolatedBumpTypeReasonText = interpolate(
      bumpTypeReasonText,
      bumpTypeReasonData
    );
    const bumpText = isRelativeVersionKeyword(bumpType)
      ? `semver relative bump "${bumpType}"`
      : `explicit semver value "${bumpType}"`;
    projectLogger.buffer(
      `❓ Applied ${bumpText}${interpolatedBumpTypeReasonText}to get new version ${newVersion}`
    );
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

    const manifestActions = this.getManifestActionsForProject(projectName);
    const releaseGroup = manifestActions.releaseGroup;
    const projectGraphNode = manifestActions.projectGraphNode;

    const dependenciesToUpdate: Record<string, string> = {};
    const dependencies = this.projectGraph.dependencies[projectName] || [];

    // TODO: should prefix handling actually move to the manifest actions? Some prefixes are likely ecosystem specific...
    // Get the versionPrefix from generatorOptions, defaulting to 'auto'
    const versionPrefix = (projectGraphNode.data.release?.version
      ?.generatorOptions?.versionPrefix ??
      releaseGroup.version?.generatorOptions?.versionPrefix ??
      'auto') as ReleaseVersionGeneratorSchema['versionPrefix'];

    const preserveLocalDependencyProtocols =
      projectGraphNode.data.release?.version?.generatorOptions
        ?.preserveLocalDependencyProtocols ??
      releaseGroup.version?.generatorOptions
        ?.preserveLocalDependencyProtocols ??
      false;

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
          // If preserveLocalDependencyProtocols is true, and the dependency uses a local dependency protocol, skip updating the dependency
          if (
            preserveLocalDependencyProtocols &&
            manifestActions.isLocalDependencyProtocol(currentDependencyVersion)
          ) {
            continue;
          }

          let finalPrefix = '';
          if (versionPrefix === 'auto') {
            const prefixMatch = currentDependencyVersion?.match(/^([~^=])/);
            finalPrefix = prefixMatch ? prefixMatch[1] : '';
          } else if (['~', '^', '='].includes(versionPrefix)) {
            finalPrefix = versionPrefix;
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

    const numDependenciesToUpdate = Object.keys(dependenciesToUpdate).length;
    if (numDependenciesToUpdate > 0) {
      const projectLogger = this.getProjectLoggerForProject(projectName);
      const depText =
        numDependenciesToUpdate === 1 ? 'dependency' : 'dependencies';
      await manifestActions.updateDependencies(
        this.tree,
        this.projectGraph,
        dependenciesToUpdate
      );
      for (const manifestPath of manifestActions.manifestsToUpdate) {
        projectLogger.buffer(
          `✍️  Updated ${numDependenciesToUpdate} ${depText} in manifest: ${manifestPath}`
        );
      }
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

    const manifestActions = this.getManifestActionsForProject(projectName);

    const { currentVersion, newVersion } = await this.calculateNewVersion(
      projectName,
      bumpType,
      bumpTypeReason,
      bumpTypeReasonData
    );

    // Write the new version to the configured manifests to update
    await manifestActions.writeVersionToManifests(this.tree, newVersion);
    for (const manifestPath of manifestActions.manifestsToUpdate) {
      projectLogger.buffer(
        `✍️  New version ${newVersion} written to manifest: ${manifestPath}`
      );
    }

    // Update version data and bumped projects
    this.versionData.set(projectName, {
      currentVersion,
      newVersion,
      dependentProjects: this.getCachedDependentProjects(projectName),
    });
    this.bumpedProjects.add(projectName);

    // Only update dependencies for dependents if updateDependents is 'auto'
    if (this.updateDependents === 'auto') {
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
          `Unable to find project "${dependent}" in allProjectsToProcess, please report this as a bug on https://github.com/nrwl/nx/issues`
        );
      }
      await this.updateDependenciesForProject(dependent);
    }
  }

  public getVersionData(): Record<string, VersionData> {
    return Object.fromEntries(this.versionData);
  }

  private getCachedDependentProjects(
    project: string
  ): VersionData['dependentProjects'] {
    return this.cachedDependentProjects.get(project) || [];
  }

  async propagateChanges(
    releaseGroupName: string,
    changedDependencyGroup: string
  ): Promise<void> {
    const releaseGroup = this.groupGraph.get(releaseGroupName)!.group;
    const releaseGroupFilteredProjects =
      this.releaseGroupToFilteredProjects.get(releaseGroup);

    let groupBumped = false;
    let bumpType: SemverBumpType = 'none';

    if (releaseGroup.projectsRelationship === 'fixed') {
      // For fixed groups, we only need to check one project
      const project = releaseGroupFilteredProjects[0];
      const dependencies = this.projectGraph.dependencies[project] || [];
      const hasDependencyInChangedGroup = dependencies.some(
        (dep) => this.findGroupForProject(dep.target) === changedDependencyGroup
      );

      if (hasDependencyInChangedGroup) {
        const dependencyBumpType = await this.getGroupBumpType(
          changedDependencyGroup
        );

        bumpType = this.determineSideEffectBump(
          releaseGroup,
          dependencyBumpType as SemverBumpType
        );
        groupBumped = bumpType !== 'none';
      }
    } else {
      // For independent groups, we need to check each project individually
      for (const project of releaseGroupFilteredProjects) {
        const dependencies = this.projectGraph.dependencies[project] || [];
        const hasDependencyInChangedGroup = dependencies.some(
          (dep) =>
            this.findGroupForProject(dep.target) === changedDependencyGroup
        );

        if (hasDependencyInChangedGroup) {
          const dependencyBumpType = await this.getGroupBumpType(
            changedDependencyGroup
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
                // TODO: Figure out if this code path is ever hit
                'UNHANDLED' as any,
                {}
              );
              this.bumpedProjects.add(project);
            }
          }
        }
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

  private async getGroupBumpType(
    releaseGroupName: string
  ): Promise<SemverBumpType | SemverVersion> {
    const releaseGroup = this.groupGraph.get(releaseGroupName)!.group;
    const releaseGroupFilteredProjects =
      this.releaseGroupToFilteredProjects.get(releaseGroup);
    if (releaseGroupFilteredProjects.size === 0) {
      return 'none';
    }
    const { bumpType } = await this.determineVersionBumpForProject(
      releaseGroup,
      releaseGroupFilteredProjects.values().next().value
    );
    return bumpType;
  }

  // TODO: Support influencing the side effect bump in a future version, patch for now as before
  private determineSideEffectBump(
    releaseGroup: ReleaseGroupWithName,
    dependencyBumpType: SemverBumpType
  ): SemverBumpType {
    const sideEffectBump = 'patch';
    return sideEffectBump as SemverBumpType;
  }
}

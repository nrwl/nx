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
import { deriveNewSemverVersion } from '../version';
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

// TODO: figure out what would actually be useful here and how it should overlap with project-logger
function verboseLog(...msgs: any[]) {
  if (process.env.NX_VERBOSE_LOGGING === 'true') {
    console.log(...msgs);
  }
}

export const validReleaseVersionPrefixes = ['auto', '', '~', '^', '='] as const;

// TODO: Can we make the implementation more efficient if we sort the projects from the projectGraph topologically upfront?

export class ReleaseGroupProcessor {
  private groupGraph: Map<string, GroupNode> = new Map();
  private processedGroups: Set<string> = new Set();
  private bumpedProjects: Set<string> = new Set();
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
  private projectLoggers: Map<string, ProjectLogger> = new Map();

  constructor(
    private tree: Tree,
    private projectGraph: ProjectGraph,
    private nxReleaseConfig: NxReleaseConfig,
    private releaseGroups: ReleaseGroupWithName[],
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

            this.projectsToManifestActions.set(
              projectName,
              await resolveManifestActionsForProject(
                this.tree,
                releaseGroupNode.group,
                projectGraphNode
              )
            );

            // Create a reusable project logger to use for the full lifecycle of the versioning process
            const projectLogger = new ProjectLogger(projectName);
            this.projectLoggers.set(
              projectName,
              new ProjectLogger(projectName)
            );

            let latestMatchingGitTag:
              | Awaited<ReturnType<typeof getLatestGitTagForPattern>>
              | undefined;
            // Cache the last matching git tag for relevant projects
            if (
              releaseGroupNode.group.version.generatorOptions
                .currentVersionResolver === 'git-tag'
            ) {
              latestMatchingGitTag = await getLatestGitTagForPattern(
                releaseGroupNode.group.releaseTagPattern,
                {
                  projectName: projectGraphNode.name,
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
              // TODO: tmp workaround for type mismatch
              this.projectsToManifestActions.get(projectName) as any,
              projectLogger,
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
      if (process.env.NX_VERBOSE_LOGGING === 'true') {
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

  private async processGroup(releaseGroupName: string): Promise<void> {
    const groupNode = this.groupGraph.get(releaseGroupName)!;
    const bumped = await this.bumpVersions(groupNode.group);

    // Flush the project loggers for the group
    for (const project of groupNode.group.projects) {
      const projectLogger = this.projectLoggers.get(project);
      if (projectLogger) {
        projectLogger.flush();
      }
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
    const bumpType = await this.determineVersionBumpForProject(
      releaseGroup,
      firstProject
    );

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
                depGroupBumpType
              );
              await this.bumpVersionForProject(project, depBumpType);
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
            verboseLog(
              `Bumping project ${project} because it is part of the fixed group.`
            );
            await this.bumpVersionForProject(project, 'patch'); // Ensure the bump for remaining projects
            this.bumpedProjects.add(project);
            await this.updateDependenciesForProject(project);
          }
        }
      }

      return bumpedByDependency;
    }

    const newVersion = await this.calculateNewVersion(firstProject, bumpType);

    // First, update versions for all projects in the fixed group
    for (const project of releaseGroup.projects) {
      const manifestActions = this.projectsToManifestActions.get(project);
      if (!manifestActions) {
        console.warn(`No manifest actions found for project ${project}`);
        continue;
      }

      try {
        const currentVersion = this.cachedCurrentVersions.get(project);
        if (!currentVersion) {
          throw new Error(
            `Unexpected error: No cached current version found for project ${project}, please report this as a bug`
          );
        }

        await this.setProjectVersion(project, newVersion);
        this.bumpedProjects.add(project);
        bumped = true;

        // Populate version data for each project
        this.versionData.set(project, {
          currentVersion,
          newVersion,
          dependentProjects: await this.getDependentProjects(project),
        });
      } catch (error) {
        console.error(`Error processing project ${project}:`, error);
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
    const projectBumpTypes = new Map<string, SemverBumpType>();
    const projectsToUpdate = new Set<string>();

    // First pass: Determine bump types
    for (const project of this.allProjectsToProcess) {
      const bumpType = await this.determineVersionBumpForProject(
        releaseGroup,
        project
      );
      verboseLog(`First pass - Project: ${project}, Bump type: ${bumpType}`);
      projectBumpTypes.set(project, bumpType);
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
        const finalBumpType = projectBumpTypes.get(project)!;
        verboseLog(
          `Second pass - Project: ${project}, Final bump type: ${finalBumpType}`
        );
        if (finalBumpType !== 'none') {
          await this.bumpVersionForProject(project, finalBumpType);
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
  ): Promise<SemverBumpType> {
    // User given specifier has the highest precedence
    if (this.userGivenSpecifier) {
      return this.userGivenSpecifier as SemverBumpType;
    }

    // If the release group has a conventional commits config, use that
    if (releaseGroup.version.conventionalCommits) {
      const currentVersion = this.cachedCurrentVersions.get(projectName);
      if (!currentVersion) {
        throw new Error(
          `Unexpected error: No cached current version found for project ${projectName}, please report this as a bug`
        );
      }
      const projectLogger = this.projectLoggers.get(projectName);
      if (!projectLogger) {
        throw new Error(
          `Unexpected error: No project logger found for project ${projectName}, please report this as a bug`
        );
      }

      // TODO: Support passing args.preid through
      const preid = undefined;
      return deriveSpecifierFromConventionalCommits(
        this.nxReleaseConfig,
        this.projectGraph,
        projectLogger,
        releaseGroup,
        this.projectGraph.nodes[projectName],
        !!prerelease(currentVersion ?? ''),
        this.cachedLatestMatchingGitTag.get(projectName),
        preid
      );
    }

    // If the release group uses version plan, resolve that way
    if (releaseGroup.versionPlans) {
      return deriveSpecifierFromVersionPlan(projectName);
    }

    // Only add the release group name to the log if it is one set by the user, otherwise it is useless noise
    const maybeLogReleaseGroup = (log: string): string => {
      if (releaseGroup.name === IMPLICIT_DEFAULT_RELEASE_GROUP) {
        return log;
      }
      return `${log} within release group "${releaseGroup.name}"`;
    };
    if (releaseGroup.version.generatorOptions?.specifierSource === 'prompt') {
      let specifier: SemverBumpType;
      if (releaseGroup.projectsRelationship === 'independent') {
        specifier = (await resolveSemverSpecifierFromPrompt(
          `${maybeLogReleaseGroup(
            `What kind of change is this for project "${projectName}"`
          )}?`,
          `${maybeLogReleaseGroup(
            `What is the exact version for project "${projectName}"`
          )}?`
          // TODO: address type discrepancy
        )) as SemverBumpType;
      } else {
        specifier = (await resolveSemverSpecifierFromPrompt(
          `${maybeLogReleaseGroup(
            `What kind of change is this for the ${releaseGroup.projects.length} matched projects(s)`
          )}?`,
          `${maybeLogReleaseGroup(
            `What is the exact version for the ${releaseGroup.projects.length} matched project(s)`
          )}?`
          // TODO: address type discrepancy
        )) as SemverBumpType;
      }
      return specifier;
    }

    throw new Error(`Unhandled version bump config`);
  }

  private async calculateNewVersion(
    project: string,
    bumpType: SemverBumpType
  ): Promise<string> {
    const currentVersion = this.cachedCurrentVersions.get(project);
    if (!currentVersion) {
      throw new Error(
        `Unexpected error: No cached current version found for project ${project}, please report this as a bug`
      );
    }
    return deriveNewSemverVersion(currentVersion, bumpType);
  }

  private async setProjectVersion(
    project: string,
    newVersion: string
  ): Promise<void> {
    const manifestActions = this.projectsToManifestActions.get(project);
    if (!manifestActions) {
      throw new Error(`No manifest actions found for project ${project}`);
    }
    await manifestActions.writeVersionToManifest(this.tree, newVersion);
  }

  // TODO: set valid values for versionPrefix somewhere
  // export const validReleaseVersionPrefixes = ['auto', '', '~', '^', '='] as const;
  // TODO: should prefix handling actually move to the manifest actions? Some prefixes are likely ecosystem specific
  private async updateDependenciesForProject(
    projectName: string
  ): Promise<void> {
    verboseLog(`Updating dependencies for project: ${projectName}`);

    if (!this.allProjectsToProcess.has(projectName)) {
      verboseLog(`Skipping ${projectName} as it's not in allProjectsToProcess`);
      return;
    }

    const manifestActions = this.projectsToManifestActions.get(projectName);
    if (!manifestActions) {
      console.error(`No manifest actions found for project ${projectName}`);
      return;
    }

    const dependenciesToUpdate: Record<string, string> = {};
    const dependencies = this.projectGraph.dependencies[projectName] || [];
    const manifestData = await manifestActions.getInitialManifestData(
      this.tree
    );

    // Get the versionPrefix from generatorOptions, defaulting to 'auto'
    // TODO: Make this config come from the release group instead, and set it on the manifest actions when instantiating it
    const versionPrefix = (this.nxReleaseConfig.version?.generatorOptions
      ?.versionPrefix ?? 'auto') as 'auto' | '~' | '^' | '=';
    verboseLog(`Version prefix: ${versionPrefix}`);

    for (const dep of dependencies) {
      if (
        this.allProjectsToProcess.has(dep.target) &&
        this.bumpedProjects.has(dep.target)
      ) {
        const targetVersionData = this.versionData.get(dep.target);
        if (targetVersionData) {
          const currentDependencyVersion =
            manifestData.dependencies['dependencies']?.[dep.target] ||
            manifestData.dependencies['devDependencies']?.[dep.target] ||
            manifestData.dependencies['peerDependencies']?.[dep.target];

          verboseLog(`Current dependency version: ${currentDependencyVersion}`);

          let finalPrefix = '';
          if (versionPrefix === 'auto') {
            const prefixMatch = currentDependencyVersion?.match(/^([~^=])/);
            finalPrefix = prefixMatch ? prefixMatch[1] : '';
          } else if (['~', '^', '='].includes(versionPrefix)) {
            finalPrefix = versionPrefix;
          }

          verboseLog(`Final prefix: ${finalPrefix}`);

          // Remove any existing prefix from the new version before applying the finalPrefix
          const cleanNewVersion = targetVersionData.newVersion.replace(
            /^[~^=]/,
            ''
          );
          dependenciesToUpdate[dep.target] = `${finalPrefix}${cleanNewVersion}`;
          verboseLog(
            `Updating dependency ${dep.target} to version ${
              dependenciesToUpdate[dep.target]
            }`
          );
        }
      }
    }

    if (Object.keys(dependenciesToUpdate).length > 0) {
      verboseLog(
        `Updating dependencies for ${projectName}:`,
        dependenciesToUpdate
      );
      await manifestActions.updateDependencies(this.tree, dependenciesToUpdate);
    } else {
      verboseLog(`No dependencies to update for ${projectName}`);
    }
  }

  private async bumpVersionForProject(
    projectName: string,
    bumpType: SemverBumpType
  ): Promise<void> {
    verboseLog(
      `Bumping version for project: ${projectName}, bump type: ${bumpType}`
    );
    if (bumpType === 'none') {
      verboseLog(`Skipping bump for ${projectName} as bump type is 'none'`);
      return;
    }

    const manifestActions = this.projectsToManifestActions.get(projectName);
    if (!manifestActions) {
      throw new Error(`No manifest actions found for project ${projectName}`);
    }

    // Use the cached current version
    const currentVersion = this.cachedCurrentVersions.get(projectName);
    if (!currentVersion) {
      throw new Error(
        `Unexpected error: No cached current version found for project ${projectName}, please report this as a bug`
      );
    }

    // Log the current and new version
    verboseLog(`Current version for ${projectName}: ${currentVersion}`);
    const newVersion = deriveNewSemverVersion(currentVersion, bumpType);
    verboseLog(`New version for ${projectName}: ${newVersion}`);

    // Log manifest writing step
    verboseLog(`Writing new version to manifest for project: ${projectName}`);
    await manifestActions.writeVersionToManifest(this.tree, newVersion);

    // Update version data
    verboseLog(`Updating version data for project: ${projectName}`);
    this.versionData.set(projectName, {
      currentVersion,
      newVersion,
      dependentProjects: await this.getDependentProjects(projectName),
    });

    // Log project bump completion
    this.bumpedProjects.add(projectName);
    verboseLog(`Project ${projectName} successfully bumped to ${newVersion}`);

    // Only update dependencies if updateDependents is 'auto'
    if (this.updateDependents === 'auto') {
      verboseLog(`Updating dependencies for dependents of ${projectName}`);
      await this.updateDependenciesForDependents(projectName);

      const dependents = this.getDependentsForProject(projectName);
      verboseLog(`Dependents of ${projectName}: ${dependents}`);

      for (const dependent of dependents) {
        if (
          this.allProjectsToProcess.has(dependent) &&
          !this.bumpedProjects.has(dependent)
        ) {
          verboseLog(`Bumping dependent project: ${dependent}`);
          await this.bumpVersionForProject(dependent, 'patch');
        }
      }
    } else {
      verboseLog(
        `Skipping dependent updates for ${projectName} as updateDependents is not 'auto'`
      );
    }
  }

  private async updateDependenciesForDependents(
    updatedProject: string
  ): Promise<void> {
    verboseLog(`Updating dependencies for dependents of ${updatedProject}`);
    const dependents = this.getDependentsForProject(updatedProject);
    verboseLog(`Dependents of ${updatedProject}:`, dependents);

    for (const dependent of dependents) {
      verboseLog(`Checking dependent: ${dependent}`);
      if (this.allProjectsToProcess.has(dependent)) {
        verboseLog(`Updating dependencies for ${dependent}`);
        await this.updateDependenciesForProject(dependent);
      } else {
        verboseLog(`Skipping ${dependent} as it's not in allProjectsToProcess`);
      }
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
          const manifestActions = this.projectsToManifestActions.get(source);
          if (manifestActions) {
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
          dependencyBumpType
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
            dependencyBumpType
          );
          if (projectBumpType !== 'none') {
            groupBumped = true;
            if (!this.bumpedProjects.has(project)) {
              await this.bumpVersionForProject(project, projectBumpType);
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
          await this.bumpVersionForProject(project, bumpType);
          this.bumpedProjects.add(project);
        }
      }
    }
  }

  private async getGroupBumpType(
    releaseGroupName: string
  ): Promise<SemverBumpType> {
    const releaseGroup = this.groupGraph.get(releaseGroupName)!.group;
    return await this.determineVersionBumpForProject(
      releaseGroup,
      releaseGroup.projects[0]
    );
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

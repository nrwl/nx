import { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import {
  isProjectWithExistingNameError,
  isProjectWithNoNameError,
  MultipleProjectsWithSameNameError,
  ProjectsWithNoNameError,
} from '../../error-types';
import {
  mergeMetadata,
  mergeTargetConfigurations,
  resolveCommandSyntacticSugar,
} from './target-merging';
import { validateProject } from './target-normalization';
import { ProjectNameInNodePropsManager } from './name-substitution-manager';
import type { ConfigurationSourceMaps, SourceInformation } from './source-maps';
import { targetSourceMapKey } from './source-maps';

import { minimatch } from 'minimatch';
import { isGlobPattern } from '../../../utils/globs';

export { validateProject } from './target-normalization';

export function mergeProjectConfigurationIntoRootMap(
  projectRootMap: Record<string, ProjectConfiguration>,
  project: ProjectConfiguration,
  configurationSourceMaps?: ConfigurationSourceMaps,
  sourceInformation?: SourceInformation,
  // This function is used when reading project configuration
  // in generators, where we don't want to do this.
  skipTargetNormalization?: boolean
): {
  nameChanged: boolean;
} {
  project.root = project.root === '' ? '.' : project.root;
  if (configurationSourceMaps && !configurationSourceMaps[project.root]) {
    configurationSourceMaps[project.root] = {};
  }
  const sourceMap = configurationSourceMaps?.[project.root];

  let matchingProject = projectRootMap[project.root];

  if (!matchingProject) {
    projectRootMap[project.root] = {
      root: project.root,
    };
    matchingProject = projectRootMap[project.root];
    if (sourceMap) {
      sourceMap[`root`] = sourceInformation;
    }
  }

  // This handles top level properties that are overwritten.
  // e.g. `srcRoot`, `projectType`, or other fields that shouldn't be extended
  // Note: `name` is set specifically here to keep it from changing. The name is
  // always determined by the first inference plugin to ID a project, unless it has
  // a project.json in which case it was already updated above.
  const updatedProjectConfiguration = {
    ...matchingProject,
  };

  for (const k in project) {
    if (
      ![
        'tags',
        'implicitDependencies',
        'generators',
        'targets',
        'metadata',
        'namedInputs',
      ].includes(k)
    ) {
      updatedProjectConfiguration[k] = project[k];
      if (sourceMap) {
        sourceMap[`${k}`] = sourceInformation;
      }
    }
  }

  // The next blocks handle properties that should be themselves merged (e.g. targets, tags, and implicit dependencies)
  if (project.tags) {
    updatedProjectConfiguration.tags = Array.from(
      new Set((matchingProject.tags ?? []).concat(project.tags))
    );

    if (sourceMap) {
      sourceMap['tags'] ??= sourceInformation;
      project.tags.forEach((tag) => {
        sourceMap[`tags.${tag}`] = sourceInformation;
      });
    }
  }

  if (project.implicitDependencies) {
    updatedProjectConfiguration.implicitDependencies = (
      matchingProject.implicitDependencies ?? []
    ).concat(project.implicitDependencies);

    if (sourceMap) {
      sourceMap['implicitDependencies'] ??= sourceInformation;
      project.implicitDependencies.forEach((implicitDependency) => {
        sourceMap[`implicitDependencies.${implicitDependency}`] =
          sourceInformation;
      });
    }
  }

  if (project.generators) {
    // Start with generators config in new project.
    updatedProjectConfiguration.generators = { ...project.generators };

    if (sourceMap) {
      sourceMap['generators'] ??= sourceInformation;
      for (const generator in project.generators) {
        sourceMap[`generators.${generator}`] = sourceInformation;
        for (const property in project.generators[generator]) {
          sourceMap[`generators.${generator}.${property}`] = sourceInformation;
        }
      }
    }

    if (matchingProject.generators) {
      // For each generator that was already defined, shallow merge the options.
      // Project contains the new info, so it has higher priority.
      for (const generator in matchingProject.generators) {
        updatedProjectConfiguration.generators[generator] = {
          ...matchingProject.generators[generator],
          ...project.generators[generator],
        };
      }
    }
  }

  if (project.namedInputs) {
    updatedProjectConfiguration.namedInputs = {
      ...matchingProject.namedInputs,
      ...project.namedInputs,
    };

    if (sourceMap) {
      sourceMap['namedInputs'] ??= sourceInformation;
      for (const namedInput in project.namedInputs) {
        sourceMap[`namedInputs.${namedInput}`] = sourceInformation;
      }
    }
  }

  if (project.metadata) {
    updatedProjectConfiguration.metadata = mergeMetadata(
      sourceMap,
      sourceInformation,
      'metadata',
      project.metadata,
      matchingProject.metadata
    );
  }

  if (project.targets) {
    // We merge the targets with special handling, so clear this back to the
    // targets as defined originally before merging.
    updatedProjectConfiguration.targets = matchingProject?.targets ?? {};
    if (sourceMap) {
      sourceMap['targets'] ??= sourceInformation;
    }

    // For each target defined in the new config
    for (const targetName in project.targets) {
      // Always set source map info for the target, but don't overwrite info already there
      // if augmenting an existing target.

      const target = project.targets?.[targetName];

      if (sourceMap) {
        sourceMap[targetSourceMapKey(targetName)] = sourceInformation;
      }

      const normalizedTarget = skipTargetNormalization
        ? target
        : resolveCommandSyntacticSugar(target, project.root);

      let matchingTargets = [];
      if (isGlobPattern(targetName)) {
        // find all targets matching the glob pattern
        // this will map atomized targets to the glob pattern same as it does for targetDefaults
        matchingTargets = Object.keys(
          updatedProjectConfiguration.targets
        ).filter((key) => minimatch(key, targetName));
      }
      // If no matching targets were found, we can assume that the target name is not (meant to be) a glob pattern
      if (!matchingTargets.length) {
        matchingTargets = [targetName];
      }

      for (const matchingTargetName of matchingTargets) {
        updatedProjectConfiguration.targets[matchingTargetName] =
          mergeTargetConfigurations(
            normalizedTarget,
            matchingProject.targets?.[matchingTargetName],
            sourceMap,
            sourceInformation,
            `targets.${matchingTargetName}`
          );
      }
    }
  }

  projectRootMap[updatedProjectConfiguration.root] =
    updatedProjectConfiguration;

  const nameChanged =
    !!updatedProjectConfiguration.name &&
    updatedProjectConfiguration.name !== matchingProject?.name;

  return { nameChanged };
}

export function readProjectConfigurationsFromRootMap(
  projectRootMap: Record<string, ProjectConfiguration>
) {
  const projects: Record<string, ProjectConfiguration> = {};
  // If there are projects that have the same name, that is an error.
  // This object tracks name -> (all roots of projects with that name)
  // to provide better error messaging.
  const conflicts = new Map<string, string[]>();
  const projectRootsWithNoName: string[] = [];

  for (const root in projectRootMap) {
    const project = projectRootMap[root];
    // We're setting `// targets` as a comment `targets` is empty due to Project Crystal.
    // Strip it before returning configuration for usage.
    if (project['// targets']) delete project['// targets'];

    try {
      validateProject(project, projects);
      projects[project.name] = project;
    } catch (e) {
      if (isProjectWithNoNameError(e)) {
        projectRootsWithNoName.push(e.projectRoot);
      } else if (isProjectWithExistingNameError(e)) {
        const rootErrors = conflicts.get(e.projectName) ?? [
          projects[e.projectName].root,
        ];
        rootErrors.push(e.projectRoot);
        conflicts.set(e.projectName, rootErrors);
      } else {
        throw e;
      }
    }
  }

  if (conflicts.size > 0) {
    throw new MultipleProjectsWithSameNameError(conflicts, projects);
  }
  if (projectRootsWithNoName.length > 0) {
    throw new ProjectsWithNoNameError(projectRootsWithNoName, projects);
  }
  return projects;
}

export function createRootMap(
  projectRootMap: Record<string, ProjectConfiguration>
) {
  const map: Record<string, string> = {};
  for (const projectRoot in projectRootMap) {
    const projectName = projectRootMap[projectRoot].name;
    map[projectRoot] = projectName;
  }
  return map;
}

/**
 * Owns the rootMap (root → ProjectConfiguration) and nameMap
 * (name → ProjectConfiguration), coordinating merges with the
 * {@link ProjectNameInNodePropsManager} for deferred name substitutions.
 *
 * The nameMap entries are the *same object references* as the rootMap
 * entries, so when a merge adds targets to a rootMap entry the nameMap
 * entry automatically has them too — no copying, no staleness.
 */
export class ProjectNodesManager {
  // root → ProjectConfiguration (the merge target)
  private rootMap: Record<string, ProjectConfiguration> = {};
  // name → ProjectConfiguration (same object references as rootMap)
  private nameMap: Record<string, ProjectConfiguration> = {};
  private nameSubstitutionManager: ProjectNameInNodePropsManager;

  constructor() {
    // Pass a lazy accessor so the substitution manager always sees
    // the current nameMap without manual synchronization.
    this.nameSubstitutionManager = new ProjectNameInNodePropsManager(
      () => this.nameMap
    );
  }

  getRootMap(): Record<string, ProjectConfiguration> {
    return this.rootMap;
  }

  /**
   * Merges a project into the rootMap, updates the nameMap, and notifies
   * the substitution manager if the name changed at this root.
   */
  mergeProjectNode(
    project: ProjectConfiguration,
    configurationSourceMaps?: ConfigurationSourceMaps,
    sourceInformation?: SourceInformation
  ): void {
    const previousName = this.rootMap[project.root]?.name;

    mergeProjectConfigurationIntoRootMap(
      this.rootMap,
      project,
      configurationSourceMaps,
      sourceInformation
    );

    const merged = this.rootMap[project.root];
    const currentName = merged?.name;

    if (currentName) {
      // Remove old nameMap entry on rename
      if (previousName && previousName !== currentName) {
        delete this.nameMap[previousName];
      }
      // Point nameMap at the same object as rootMap
      this.nameMap[currentName] = merged;

      // Notify substitution manager of name change
      if (currentName !== previousName) {
        this.nameSubstitutionManager.identifyProjectWithRoot(
          project.root,
          currentName
        );
      }
    }
  }

  /**
   * Registers substitutors for a plugin result's project references
   * in `inputs` and `dependsOn`.
   */
  registerSubstitutors(
    pluginResultProjects?: Record<
      string,
      Omit<ProjectConfiguration, 'root'> & Partial<ProjectConfiguration>
    >
  ): void {
    this.nameSubstitutionManager.registerSubstitutorsForNodeResults(
      pluginResultProjects
    );
  }

  /**
   * Applies all pending name substitutions. Call once after all plugin
   * results have been merged.
   */
  applySubstitutions(): void {
    this.nameSubstitutionManager.applySubstitutions(this.rootMap);
  }
}

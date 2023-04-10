import { FileChange, readPackageJson } from '../file-utils';
import {
  getImplicitlyTouchedProjects,
  getTouchedProjects,
} from './locators/workspace-projects';
import { getTouchedNpmPackages } from './locators/npm-packages';
import {
  AffectedProjectGraphContext,
  LocatorResult,
  TouchedProjectLocator,
} from './affected-project-graph-models';
import { getTouchedProjectsFromTsConfig } from './locators/tsconfig-json-changes';
import { NxJsonConfiguration } from '../../config/nx-json';
import { ProjectGraph } from '../../config/project-graph';
import { reverse } from '../operators';
import { readNxJson } from '../../config/configuration';
import { getTouchedProjectsFromProjectGlobChanges } from './locators/project-glob-changes';
import { PackageJson } from '../../utils/package-json';
import { addReasonForProject } from './locators/locator-utils';

// Additional affected logic should be in this array.
const touchedProjectLocators: TouchedProjectLocator[] = [
  getTouchedProjects,
  getImplicitlyTouchedProjects,
  getTouchedNpmPackages,
  getTouchedProjectsFromTsConfig,
  getTouchedProjectsFromProjectGlobChanges,
];

export async function filterAffected(
  graph: ProjectGraph,
  touchedFiles: FileChange[],
  nxJson: NxJsonConfiguration = readNxJson(),
  packageJson: PackageJson = readPackageJson()
): Promise<ProjectGraph> {
  const touchedProjects = [];
  for (const locator of touchedProjectLocators) {
    const projects = await locator(
      touchedFiles,
      graph.nodes,
      nxJson,
      packageJson,
      graph
    );
    if (projects instanceof Map) {
      touchedProjects.push(...projects.keys());
    }
  }

  return filterAffectedProjects(graph, {
    projectGraphNodes: graph.nodes,
    nxJson,
    touchedProjects,
  });
}

export async function getReasonsAffected(
  graph: ProjectGraph,
  touchedFiles: FileChange[],
  nxJson: NxJsonConfiguration = readNxJson(),
  packageJson: any = readPackageJson()
): Promise<LocatorResult> {
  const reasonsAffected: LocatorResult = new Map(); // ProjectName, ReasonAffected[]

  for (const locator of touchedProjectLocators) {
    const projects = await locator(
      touchedFiles,
      graph.nodes,
      nxJson,
      packageJson,
      graph
    );
    for (const [project, reasons] of projects) {
      const normalized = Array.isArray(reasons) ? reasons : [reasons];
      if (reasonsAffected.has(project)) {
        reasonsAffected.get(project).push(...normalized);
      } else {
        reasonsAffected.set(project, normalized);
      }
    }
  }

  const changedDependencies = new Map<string, Set<string>>();
  for (const project of reasonsAffected.keys()) {
    const dependants = collectProjectDependants(project, reverse(graph));
    for (const dependant of dependants) {
      const existing = changedDependencies.get(dependant);
      if (existing) {
        existing.add(project);
      } else {
        changedDependencies.set(dependant, new Set([project]));
      }
    }
  }
  for (const [project, dependencies] of changedDependencies) {
    for (const dep of dependencies) {
      addReasonForProject(
        project,
        'Affected by dependencies',
        dep,
        reasonsAffected
      );
    }
  }

  return reasonsAffected;
}

// -----------------------------------------------------------------------------

function filterAffectedProjects(
  graph: ProjectGraph,
  ctx: AffectedProjectGraphContext
): ProjectGraph {
  const result: ProjectGraph = {
    nodes: {},
    externalNodes: {},
    dependencies: {},
  };
  const reversed = reverse(graph);
  ctx.touchedProjects.forEach((p) => {
    addAffectedNodes(p, reversed, result, []);
  });
  ctx.touchedProjects.forEach((p) => {
    addAffectedDependencies(p, reversed, result, []);
  });
  return result;
}

function collectProjectDependants(
  startingProject: string,
  reversed: ProjectGraph
): Set<string> {
  function _collectDependencies(
    startingProject: string,
    reversed: ProjectGraph,
    result: Set<string>,
    visited: Set<string>
  ) {
    if (visited.has(startingProject)) return;
    visited.add(startingProject);
    reversed.dependencies[startingProject]?.forEach(({ target }) => {
      result.add(target);
      _collectDependencies(target, reversed, result, visited);
    });
  }
  const result: Set<string> = new Set();
  _collectDependencies(startingProject, reversed, result, new Set());
  return result;
}

function addAffectedNodes(
  startingProject: string,
  reversed: ProjectGraph,
  result: ProjectGraph,
  visited: string[]
): void {
  const dependants = collectProjectDependants(startingProject, reversed);
  for (const projectNode of [startingProject, ...dependants]) {
    const reversedNode = reversed.nodes[projectNode];
    const reversedExternalNode = reversed.externalNodes[projectNode];
    if (!reversedNode && !reversedExternalNode) {
      throw new Error(`Invalid project name is detected: "${projectNode}"`);
    }
    if (reversedNode) {
      result.nodes[projectNode] = reversedNode;
      result.dependencies[projectNode] = [];
    } else {
      result.externalNodes[projectNode] = reversedExternalNode;
    }
  }
}

function addAffectedDependencies(
  startingProject: string,
  reversed: ProjectGraph,
  result: ProjectGraph,
  visited: string[]
): void {
  if (visited.indexOf(startingProject) > -1) return;
  visited.push(startingProject);
  if (reversed.dependencies[startingProject]) {
    reversed.dependencies[startingProject].forEach(({ target }) =>
      addAffectedDependencies(target, reversed, result, visited)
    );
    reversed.dependencies[startingProject].forEach(
      ({ type, source, target }) => {
        // Since source and target was reversed,
        // we need to reverse it back to original direction.
        if (!result.dependencies[target]) {
          result.dependencies[target] = [];
        }
        result.dependencies[target].push({
          type,
          source: target,
          target: source,
        });
      }
    );
  }
}

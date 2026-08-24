import { minimatch } from 'minimatch';
import type { NxJsonConfiguration } from '../../config/nx-json';
import type { ProjectGraph } from '../../config/project-graph';
import type { Task } from '../../config/task-graph';
import {
  expandNamedInput,
  getInputs,
  getNamedInputs,
  type ExpandedInput,
} from '../../hasher/task-inputs';
import { findMatchingProjects } from '../../utils/find-matching-projects';
import type { FileChange } from '../file-utils';
import {
  createProjectRootMappings,
  findProjectForPath,
} from '../utils/find-project-for-path';

export interface RequestedTask {
  project: string;
  target: string;
}

const WORKSPACE_CONFIGURATION_FILES = new Set([
  'angular.json',
  'nx.json',
  'package.json',
  'workspace.json',
]);
const LOCK_FILES = new Set([
  'bun.lock',
  'bun.lockb',
  'package-lock.json',
  'pnpm-lock.yaml',
  'pnpm-lock.yml',
  'yarn.lock',
]);

/**
 * Narrows an existing affected-project result. It intentionally does not add
 * projects that the baseline affected calculation did not select.
 */
export function filterAffectedTasksByInputs(
  candidates: RequestedTask[],
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration,
  changes: FileChange[],
  isCustomHasherTask: (task: RequestedTask) => boolean = () => false
): RequestedTask[] {
  const changedPaths = changes.map(({ file }) => normalizePath(file));
  const projectRootMappings = createProjectRootMappings(projectGraph.nodes);
  const projectConfigurationChanges = new Map<string, string>();
  let unownedProjectConfigurationChange: string | undefined;
  for (const path of changedPaths) {
    if (!isProjectConfigurationFile(path)) continue;
    const project = findProjectForPath(path, projectRootMappings);
    if (project && !projectConfigurationChanges.has(project)) {
      projectConfigurationChanges.set(project, path);
    } else if (!project) {
      unownedProjectConfigurationChange ??= path;
    }
  }
  const workspaceConfigurationChange =
    changedPaths.find((path) => isWorkspaceConfigurationFile(path)) ??
    unownedProjectConfigurationChange;

  return candidates.filter((task) => {
    if (isCustomHasherTask(task)) {
      return true;
    }
    if (workspaceConfigurationChange) {
      return true;
    }

    return matchTaskInputs(
      task,
      projectGraph,
      nxJson,
      changedPaths,
      projectConfigurationChanges
    );
  });
}

function matchTaskInputs(
  task: RequestedTask,
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration,
  changedPaths: string[],
  projectConfigurationChanges: ReadonlyMap<string, string>
): boolean {
  const inputs = getInputs({ target: task } as Task, projectGraph, nxJson);
  if (projectConfigurationChanges.has(task.project)) {
    return true;
  }

  if (inputs.selfInputs.some(isUnsupportedInput)) {
    return true;
  }
  if (inputs.depsOutputs.length > 0) {
    return true;
  }

  if (
    matchProjectInputSet(
      task.project,
      inputs.selfInputs,
      projectGraph,
      changedPaths
    )
  ) {
    return true;
  }

  const dependencies = collectProjectDependencies(task.project, projectGraph);
  for (const dependency of dependencies) {
    const dependencyNode = projectGraph.nodes[dependency];
    if (!dependencyNode) continue;
    if (
      projectConfigurationChanges.has(dependency) &&
      (inputs.depsInputs.length > 0 || inputs.depsFilesets.length > 0)
    ) {
      return true;
    }

    let expanded: ExpandedInput[];
    try {
      const namedInputs = getNamedInputs(nxJson, dependencyNode);
      expanded = inputs.depsInputs.flatMap(({ input }) =>
        expandNamedInput(input, namedInputs)
      );
    } catch {
      return true;
    }

    if (expanded.some(isUnsupportedInput)) {
      return true;
    }

    if (
      matchProjectInputSet(
        dependency,
        [
          ...expanded,
          ...inputs.depsFilesets.map(({ fileset }) => ({ fileset })),
        ],
        projectGraph,
        changedPaths
      )
    ) {
      return true;
    }
  }

  for (const projectInput of inputs.projectInputs) {
    const inputProjects = findMatchingProjects(
      projectInput.projects,
      projectGraph.nodes
    );
    if (inputProjects.length === 0) {
      return true;
    }
    for (const inputProject of inputProjects) {
      const inputProjectNode = projectGraph.nodes[inputProject];
      if (projectConfigurationChanges.has(inputProject)) {
        return true;
      }

      let expanded: ExpandedInput[];
      try {
        expanded = expandNamedInput(
          projectInput.input,
          getNamedInputs(nxJson, inputProjectNode)
        );
      } catch {
        return true;
      }
      if (expanded.some(isUnsupportedInput)) {
        return true;
      }

      if (
        matchProjectInputSet(inputProject, expanded, projectGraph, changedPaths)
      ) {
        return true;
      }
    }
  }

  return false;
}

function matchProjectInputSet(
  projectName: string,
  inputs: readonly ExpandedInput[],
  projectGraph: ProjectGraph,
  changedPaths: string[]
): boolean {
  const project = projectGraph.nodes[projectName];
  const patterns = inputs
    .filter((input): input is { fileset: string } => 'fileset' in input)
    .map(({ fileset }) =>
      expandTokens(fileset, project.data.root, projectName)
    );

  return changedPaths.some((path) => matchesFileset(path, patterns));
}

function matchesFileset(path: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;

  const positive = patterns.filter((pattern) => !pattern.startsWith('!'));
  const negative = patterns
    .filter((pattern) => pattern.startsWith('!'))
    .map((pattern) => pattern.slice(1));

  const included =
    positive.length === 0 ||
    positive.some((pattern) => minimatch(path, pattern, { dot: true }));
  return (
    included &&
    negative.every((pattern) => !minimatch(path, pattern, { dot: true }))
  );
}

function expandTokens(
  pattern: string,
  projectRoot: string,
  projectName: string
): string {
  const negated = pattern.startsWith('!');
  let expanded = negated ? pattern.slice(1) : pattern;
  expanded = expanded
    .replaceAll('{projectRoot}', projectRoot === '.' ? '' : projectRoot)
    .replaceAll('{workspaceRoot}', '')
    .replaceAll('{projectName}', projectName)
    .replace(/^\.\//, '')
    .replace(/^\//, '');
  return negated ? `!${expanded}` : expanded;
}

function collectProjectDependencies(
  projectName: string,
  projectGraph: ProjectGraph
): string[] {
  const result: string[] = [];
  const seen = new Set<string>([projectName]);
  const visit = (name: string) => {
    for (const dependency of projectGraph.dependencies[name] ?? []) {
      if (seen.has(dependency.target)) continue;
      seen.add(dependency.target);
      if (projectGraph.nodes[dependency.target]) {
        result.push(dependency.target);
        visit(dependency.target);
      }
    }
  };
  visit(projectName);
  return result;
}

function isUnsupportedInput(input: ExpandedInput): boolean {
  return !('fileset' in input);
}

function isWorkspaceConfigurationFile(path: string): boolean {
  return WORKSPACE_CONFIGURATION_FILES.has(path) || LOCK_FILES.has(path);
}

function isProjectConfigurationFile(path: string): boolean {
  const basename = path.split('/').pop() ?? path;
  return (
    basename === 'package.json' ||
    basename === 'project.json' ||
    /^tsconfig(?:\..+)?\.json$/.test(basename) ||
    /(?:^|\.)config\.[cm]?[jt]s$/.test(basename)
  );
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

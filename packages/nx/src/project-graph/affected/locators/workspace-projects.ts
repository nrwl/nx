import { minimatch } from 'minimatch';
import { TouchedProjectLocator } from '../affected-project-graph-models';
import {
  createProjectRootMappings,
  findProjectForPath,
} from '../../utils/find-project-for-path';
import { InputDefinition } from '../../../config/workspace-json-project-json';

export const getTouchedProjects: TouchedProjectLocator = (
  touchedFiles,
  projectGraphNodes
): string[] => {
  const projectRootMap = createProjectRootMappings(projectGraphNodes);

  return touchedFiles.reduce((affected, f) => {
    const matchingProject = findProjectForPath(f.file, projectRootMap);
    if (matchingProject) {
      affected.push(matchingProject);
    }
    return affected;
  }, []);
};

export const getImplicitlyTouchedProjects: TouchedProjectLocator = (
  fileChanges,
  projectGraphNodes,
  nxJson
): string[] => {
  const implicits = {
    'nx.json': '*',
  };

  Object.values(projectGraphNodes || {}).forEach((node) => {
    const namedInputs = {
      ...nxJson.namedInputs,
      ...node.data.namedInputs,
    };
    extractFilesFromTargetInputs(node.data.targets, namedInputs).forEach(
      (input) => {
        implicits[input] ??= [];

        if (Array.isArray(implicits[input])) {
          implicits[input].push(node.name);
        }
      }
    );
  });

  const touched = new Set<string>();

  for (const [pattern, projects] of Object.entries(implicits)) {
    const implicitDependencyWasChanged = fileChanges.some((f) =>
      minimatch(f.file, pattern, { dot: true })
    );
    if (!implicitDependencyWasChanged) {
      continue;
    }

    // File change affects all projects, just return all projects.
    if (projects === '*') {
      return Object.keys(projectGraphNodes);
    } else if (Array.isArray(projects)) {
      projects.forEach((project) => touched.add(project));
    }
  }

  return Array.from(touched);
};

function extractFilesFromTargetInputs(
  targets: any,
  namedInputs: Record<string, Array<string | InputDefinition>>
) {
  const globalFiles = [];
  for (const target of Object.values(targets || {})) {
    if ((target as any).inputs) {
      globalFiles.push(
        ...extractFilesFromInputs((target as any).inputs, namedInputs)
      );
    }
  }
  return globalFiles;
}

function extractFilesFromInputs(
  inputs: any,
  namedInputs: Record<string, Array<string | InputDefinition>>
) {
  const globalFiles = [];
  for (const input of inputs) {
    if (typeof input === 'string' && input in namedInputs) {
      globalFiles.push(
        ...extractFilesFromInputs(namedInputs[input], namedInputs)
      );
    } else if (
      typeof input === 'string' &&
      input.startsWith('{workspaceRoot}/')
    ) {
      globalFiles.push(input.substring('{workspaceRoot}/'.length));
    } else if (input.fileset && input.fileset.startsWith('{workspaceRoot}/')) {
      globalFiles.push(input.fileset.substring('{workspaceRoot}/'.length));
    }
  }
  return globalFiles;
}

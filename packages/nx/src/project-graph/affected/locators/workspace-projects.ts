import * as minimatch from 'minimatch';
import { TouchedProjectLocator } from '../affected-project-graph-models';
import { NxJsonConfiguration } from '../../../config/nx-json';
import {
  createProjectRootMappings,
  findProjectForPath,
} from '../../utils/find-project-for-path';

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
  const implicits = {};
  const globalFiles = [...extractGlobalFilesFromInputs(nxJson), 'nx.json'];
  globalFiles.forEach((file) => {
    implicits[file] = '*' as any;
  });

  Object.values(projectGraphNodes || {}).forEach((node) => {
    [
      ...extractFilesFromNamedInputs(node.data.namedInputs),
      ...extractFilesFromTargetInputs(node.data.targets),
    ].forEach((input) => {
      implicits[input] ??= [];

      if (Array.isArray(implicits[input])) {
        implicits[input].push(node.name);
      }
    });
  });

  const touched = new Set<string>();

  for (const [pattern, projects] of Object.entries(implicits)) {
    const implicitDependencyWasChanged = fileChanges.some((f) =>
      minimatch(f.file, pattern)
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

export function extractGlobalFilesFromInputs(nxJson: NxJsonConfiguration) {
  const globalFiles = [];
  globalFiles.push(...extractFilesFromNamedInputs(nxJson.namedInputs));
  globalFiles.push(...extractFilesFromTargetInputs(nxJson.targetDefaults));
  return globalFiles;
}

function extractFilesFromNamedInputs(namedInputs: any) {
  const files = [];
  for (const inputs of Object.values(namedInputs || {})) {
    files.push(...extractFilesFromInputs(inputs));
  }
  return files;
}

function extractFilesFromTargetInputs(targets: any) {
  const globalFiles = [];
  for (const target of Object.values(targets || {})) {
    if ((target as any).inputs) {
      globalFiles.push(...extractFilesFromInputs((target as any).inputs));
    }
  }
  return globalFiles;
}

function extractFilesFromInputs(inputs: any) {
  const globalFiles = [];
  for (const input of inputs) {
    if (typeof input === 'string' && input.startsWith('{workspaceRoot}/')) {
      globalFiles.push(input.substring('{workspaceRoot}/'.length));
    } else if (input.fileset && input.fileset.startsWith('{workspaceRoot}/')) {
      globalFiles.push(input.fileset.substring('{workspaceRoot}/'.length));
    }
  }
  return globalFiles;
}

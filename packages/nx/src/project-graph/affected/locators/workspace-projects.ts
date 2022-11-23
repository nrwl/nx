import * as minimatch from 'minimatch';
import { TouchedProjectLocator } from '../affected-project-graph-models';
import { NxJsonConfiguration } from '../../../config/nx-json';
import { ProjectGraphProjectNode } from '../../../config/project-graph';
import { createProjectPathMappings } from '../../utils/get-project';

export const getTouchedProjects: TouchedProjectLocator = (
  touchedFiles,
  projectGraphNodes
): string[] => {
  const allProjectFiles = createProjectPathMappings(projectGraphNodes);
  const affected = [];

  touchedFiles.forEach((f) => {
    const matchingProject = allProjectFiles[f.file];
    if (matchingProject) {
      affected.push(matchingProject);
    }
  });

  return affected;
};

export const getImplicitlyTouchedProjects: TouchedProjectLocator = (
  fileChanges,
  projectGraphNodes,
  nxJson
): string[] => {
  const implicits = { ...nxJson.implicitDependencies };
  const globalFiles = [
    ...extractGlobalFilesFromInputs(nxJson, projectGraphNodes),
    'nx.json',
  ];
  globalFiles.forEach((file) => {
    implicits[file] = '*' as any;
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

export function extractGlobalFilesFromInputs(
  nxJson: NxJsonConfiguration,
  projectGraphNodes: Record<string, ProjectGraphProjectNode>
) {
  const globalFiles = [];
  globalFiles.push(...extractGlobalFilesFromNamedInputs(nxJson.namedInputs));
  globalFiles.push(...extractGlobalFilesFromTargets(nxJson.targetDefaults));
  Object.values(projectGraphNodes || {}).forEach((node) => {
    globalFiles.push(
      ...extractGlobalFilesFromNamedInputs(node.data.namedInputs)
    );
    globalFiles.push(...extractGlobalFilesFromTargets(node.data.targets));
  });
  return globalFiles;
}

function extractGlobalFilesFromNamedInputs(namedInputs: any) {
  const globalFiles = [];
  for (const inputs of Object.values(namedInputs || {})) {
    globalFiles.push(...extractGlobalFiles(inputs));
  }
  return globalFiles;
}

function extractGlobalFilesFromTargets(targets: any) {
  const globalFiles = [];
  for (const target of Object.values(targets || {})) {
    if ((target as any).inputs) {
      globalFiles.push(...extractGlobalFiles((target as any).inputs));
    }
  }
  return globalFiles;
}

function extractGlobalFiles(inputs: any) {
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

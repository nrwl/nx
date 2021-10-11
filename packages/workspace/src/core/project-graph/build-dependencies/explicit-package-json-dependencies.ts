import { ProjectGraph, ProjectGraphNodeRecords } from '../project-graph-models';
import { defaultFileRead } from '../../file-utils';
import {
  joinPathFragments,
  parseJson,
  ProjectFileMap,
  Workspace,
} from '@nrwl/devkit';

export function buildExplicitPackageJsonDependencies(
  workspace: Workspace,
  graph: ProjectGraph,
  filesToProcess: ProjectFileMap
) {
  const res = [] as any;
  Object.keys(filesToProcess).forEach((source) => {
    Object.values(filesToProcess[source]).forEach((f) => {
      if (isPackageJsonAtProjectRoot(graph.nodes, f.file)) {
        processPackageJson(source, f.file, graph, res);
      }
    });
  });
  return res;
}

function isPackageJsonAtProjectRoot(
  nodes: ProjectGraphNodeRecords,
  fileName: string
) {
  return Object.values(nodes).find(
    (projectNode) =>
      (projectNode.type === 'lib' || projectNode.type === 'app') &&
      joinPathFragments(projectNode.data.root, 'package.json') === fileName
  );
}

function processPackageJson(
  sourceProject: string,
  fileName: string,
  graph: ProjectGraph,
  collectedDeps: any[]
) {
  try {
    const deps = readDeps(parseJson(defaultFileRead(fileName)));
    deps.forEach((d) => {
      // package.json refers to another project in the monorepo
      if (graph.nodes[d]) {
        collectedDeps.push({
          sourceProjectName: sourceProject,
          targetProjectName: d,
          sourceProjectFile: fileName,
        });
      }
    });
  } catch (e) {
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.log(e);
    }
  }
}

function readDeps(packageJsonDeps: any) {
  return [
    ...Object.keys(packageJsonDeps?.dependencies ?? {}),
    ...Object.keys(packageJsonDeps?.devDependencies ?? {}),
  ];
}

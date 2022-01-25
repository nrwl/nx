import { ProjectGraph, ProjectGraphNodeRecords } from '../project-graph-models';
import { defaultFileRead } from '../../file-utils';
import {
  joinPathFragments,
  parseJson,
  ProjectFileMap,
  Workspace,
} from '@nrwl/devkit';
import { join } from 'path';

export function buildExplicitPackageJsonDependencies(
  workspace: Workspace,
  graph: ProjectGraph,
  filesToProcess: ProjectFileMap
) {
  const res = [] as any;
  let packageNameMap = undefined;
  Object.keys(filesToProcess).forEach((source) => {
    Object.values(filesToProcess[source]).forEach((f) => {
      if (isPackageJsonAtProjectRoot(graph.nodes, f.file)) {
        // we only create the package name map once and only if a package.json file changes
        packageNameMap = packageNameMap || createPackageNameMap(workspace);
        processPackageJson(source, f.file, graph, res, packageNameMap);
      }
    });
  });
  return res;
}

function createPackageNameMap(w: Workspace) {
  const res = {};
  for (let projectName of Object.keys(w.projects)) {
    try {
      const packageJson = parseJson(
        defaultFileRead(join(w.projects[projectName].root, 'package.json'))
      );
      res[packageJson.name || `@${w.npmScope}/${projectName}`] = projectName;
    } catch (e) {}
  }
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
  collectedDeps: any[],
  packageNameMap: { [packageName: string]: string }
) {
  try {
    const deps = readDeps(parseJson(defaultFileRead(fileName)));
    // the name matches the import path
    deps.forEach((d) => {
      // package.json refers to another project in the monorepo
      if (packageNameMap[d]) {
        collectedDeps.push({
          sourceProjectName: sourceProject,
          targetProjectName: packageNameMap[d],
          sourceProjectFile: fileName,
        });
      } else if (graph.externalNodes[`npm:${d}`]) {
        collectedDeps.push({
          sourceProjectName: sourceProject,
          targetProjectName: `npm:${d}`,
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
    ...Object.keys(packageJsonDeps?.peerDependencies ?? {}),
  ];
}

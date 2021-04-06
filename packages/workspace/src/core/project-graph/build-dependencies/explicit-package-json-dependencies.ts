import {
  AddProjectDependency,
  DependencyType,
  ProjectGraphContext,
  ProjectGraphNodeRecords,
} from '../project-graph-models';
import { defaultFileRead } from '../../file-utils';
import { parseJsonWithComments } from '@nrwl/workspace/src/utilities/fileutils';
import { joinPathFragments } from '@nrwl/devkit';

export function buildExplicitPackageJsonDependencies(
  ctx: ProjectGraphContext,
  nodes: ProjectGraphNodeRecords,
  addDependency: AddProjectDependency
) {
  Object.keys(ctx.fileMap).forEach((source) => {
    Object.values(ctx.fileMap[source]).forEach((f) => {
      if (isPackageJsonAtProjectRoot(nodes, f.file)) {
        processPackageJson(source, f.file, nodes, addDependency);
      }
    });
  });
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
  nodes: ProjectGraphNodeRecords,
  addDependency: AddProjectDependency
) {
  try {
    const deps = readDeps(parseJsonWithComments(defaultFileRead(fileName)));
    deps.forEach((d) => {
      // package.json refers to another project in the monorepo
      if (nodes[d]) {
        addDependency(DependencyType.static, sourceProject, d);
      }
    });
  } catch (e) {
    if (process.env.NX_VERBOSE_LOGGING) {
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

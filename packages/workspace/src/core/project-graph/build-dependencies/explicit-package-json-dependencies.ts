import { ProjectGraphNodeRecords } from '../project-graph-models';
import { defaultFileRead } from '../../file-utils';
import {
  joinPathFragments,
  parseJson,
  ProjectGraphBuilder,
  ProjectGraphProcessorContext,
} from '@nrwl/devkit';

export function buildExplicitPackageJsonDependencies(
  ctx: ProjectGraphProcessorContext,
  builder: ProjectGraphBuilder
) {
  Object.keys(ctx.filesToProcess).forEach((source) => {
    Object.values(ctx.filesToProcess[source]).forEach((f) => {
      if (isPackageJsonAtProjectRoot(builder.graph.nodes, f.file)) {
        processPackageJson(source, f.file, builder);
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
  builder: ProjectGraphBuilder
) {
  try {
    const deps = readDeps(parseJson(defaultFileRead(fileName)));
    deps.forEach((d) => {
      // package.json refers to another project in the monorepo
      if (builder.graph.nodes[d]) {
        builder.addExplicitDependency(sourceProject, fileName, d);
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

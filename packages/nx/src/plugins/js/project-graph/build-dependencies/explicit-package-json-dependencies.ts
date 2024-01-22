import { defaultFileRead } from '../../../../project-graph/file-utils';
import { join } from 'path';
import { DependencyType } from '../../../../config/project-graph';
import { parseJson } from '../../../../utils/json';
import { joinPathFragments } from '../../../../utils/path';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
} from '../../../../config/workspace-json-project-json';
import { NxJsonConfiguration } from '../../../../config/nx-json';
import { PackageJson } from '../../../../utils/package-json';
import { CreateDependenciesContext } from '../../../../utils/nx-plugin';
import {
  RawProjectGraphDependency,
  validateDependency,
} from '../../../../project-graph/project-graph-builder';

export function buildExplicitPackageJsonDependencies(
  ctx: CreateDependenciesContext
): RawProjectGraphDependency[] {
  const res: RawProjectGraphDependency[] = [];
  let packageNameMap = undefined;
  const nodes = Object.values(ctx.projects);
  Object.keys(ctx.filesToProcess.projectFileMap).forEach((source) => {
    Object.values(ctx.filesToProcess.projectFileMap[source]).forEach((f) => {
      if (isPackageJsonAtProjectRoot(nodes, f.file)) {
        // we only create the package name map once and only if a package.json file changes
        packageNameMap = packageNameMap || createPackageNameMap(ctx.projects);
        processPackageJson(source, f.file, ctx, res, packageNameMap);
      }
    });
  });
  return res;
}

function createPackageNameMap(projects: ProjectsConfigurations['projects']) {
  const res = {};
  for (let projectName of Object.keys(projects)) {
    try {
      const packageJson = parseJson(
        defaultFileRead(join(projects[projectName].root, 'package.json'))
      );
      res[packageJson.name ?? projectName] = projectName;
    } catch (e) {}
  }
  return res;
}

function isPackageJsonAtProjectRoot(
  nodes: ProjectConfiguration[],
  fileName: string
) {
  return (
    fileName.endsWith('package.json') &&
    nodes.find(
      (projectNode) =>
        joinPathFragments(projectNode.root, 'package.json') === fileName
    )
  );
}

function processPackageJson(
  sourceProject: string,
  fileName: string,
  ctx: CreateDependenciesContext,
  collectedDeps: RawProjectGraphDependency[],
  packageNameMap: { [packageName: string]: string }
) {
  try {
    const deps = readDeps(parseJson(defaultFileRead(fileName)));
    // the name matches the import path
    deps.forEach((d) => {
      // package.json refers to another project in the monorepo
      if (packageNameMap[d]) {
        const dependency: RawProjectGraphDependency = {
          source: sourceProject,
          target: packageNameMap[d],
          sourceFile: fileName,
          type: DependencyType.static,
        };
        validateDependency(dependency, ctx);
        collectedDeps.push(dependency);
      } else if (ctx.externalNodes[`npm:${d}`]) {
        const dependency: RawProjectGraphDependency = {
          source: sourceProject,
          target: `npm:${d}`,
          sourceFile: fileName,
          type: DependencyType.static,
        };
        validateDependency(dependency, ctx);
        collectedDeps.push(dependency);
      }
    });
  } catch (e) {
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.log(e);
    }
  }
}

function readDeps(packageJson: PackageJson) {
  return [
    ...Object.keys(packageJson?.dependencies ?? {}),
    ...Object.keys(packageJson?.devDependencies ?? {}),
    ...Object.keys(packageJson?.peerDependencies ?? {}),
    ...Object.keys(packageJson?.optionalDependencies ?? {}),
  ];
}

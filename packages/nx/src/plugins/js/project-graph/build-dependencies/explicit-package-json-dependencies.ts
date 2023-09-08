import { defaultFileRead } from '../../../../project-graph/file-utils';
import { join } from 'path';
import {
  DependencyType,
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../../config/project-graph';
import { parseJson } from '../../../../utils/json';
import { joinPathFragments } from '../../../../utils/path';
import { ProjectsConfigurations } from '../../../../config/workspace-json-project-json';
import { NxJsonConfiguration } from '../../../../config/nx-json';
import { PackageJson } from '../../../../utils/package-json';
import { CreateDependenciesContext } from '../../../../utils/nx-plugin';
import {
  ProjectGraphDependencyWithFile,
  validateDependency,
} from '../../../../project-graph/project-graph-builder';

export function buildExplicitPackageJsonDependencies({
  nxJsonConfiguration,
  projectsConfigurations,
  graph,
  filesToProcess,
}: CreateDependenciesContext): ProjectGraphDependencyWithFile[] {
  const res: ProjectGraphDependencyWithFile[] = [];
  let packageNameMap = undefined;
  const nodes = Object.values(graph.nodes);
  Object.keys(filesToProcess).forEach((source) => {
    Object.values(filesToProcess[source]).forEach((f) => {
      if (isPackageJsonAtProjectRoot(nodes, f.file)) {
        // we only create the package name map once and only if a package.json file changes
        packageNameMap =
          packageNameMap ||
          createPackageNameMap(nxJsonConfiguration, projectsConfigurations);
        processPackageJson(source, f.file, graph, res, packageNameMap);
      }
    });
  });
  return res;
}

function createPackageNameMap(
  nxJsonConfiguration: NxJsonConfiguration,
  projectsConfigurations: ProjectsConfigurations
) {
  const res = {};
  for (let projectName of Object.keys(projectsConfigurations.projects)) {
    try {
      const packageJson = parseJson(
        defaultFileRead(
          join(
            projectsConfigurations.projects[projectName].root,
            'package.json'
          )
        )
      );
      // TODO(v17): Stop reading nx.json for the npmScope
      const npmScope = nxJsonConfiguration.npmScope;
      res[
        packageJson.name ??
          (npmScope
            ? `${npmScope === '@' ? '' : '@'}${npmScope}/${projectName}`
            : projectName)
      ] = projectName;
    } catch (e) {}
  }
  return res;
}

function isPackageJsonAtProjectRoot(
  nodes: ProjectGraphProjectNode[],
  fileName: string
) {
  return (
    fileName.endsWith('package.json') &&
    nodes.find(
      (projectNode) =>
        (projectNode.type === 'lib' || projectNode.type === 'app') &&
        joinPathFragments(projectNode.data.root, 'package.json') === fileName
    )
  );
}

function processPackageJson(
  sourceProject: string,
  fileName: string,
  graph: ProjectGraph,
  collectedDeps: ProjectGraphDependencyWithFile[],
  packageNameMap: { [packageName: string]: string }
) {
  try {
    const deps = readDeps(parseJson(defaultFileRead(fileName)));
    // the name matches the import path
    deps.forEach((d) => {
      // package.json refers to another project in the monorepo
      if (packageNameMap[d]) {
        const dependency = {
          source: sourceProject,
          target: packageNameMap[d],
          sourceFile: fileName,
          dependencyType: DependencyType.static,
        };
        validateDependency(graph, dependency);
        collectedDeps.push(dependency);
      } else if (graph.externalNodes[`npm:${d}`]) {
        const dependency = {
          source: sourceProject,
          target: `npm:${d}`,
          sourceFile: fileName,
          dependencyType: DependencyType.static,
        };
        validateDependency(graph, dependency);
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

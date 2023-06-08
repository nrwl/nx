import { defaultFileRead } from '../../../../project-graph/file-utils';
import { join } from 'path';
import {
  DependencyType,
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../../config/project-graph';
import { parseJson } from '../../../../utils/json';
import { joinPathFragments } from '../../../../utils/path';
import { ProjectsConfigurations } from '../../../../config/workspace-json-project-json';
import { NxJsonConfiguration } from '../../../../config/nx-json';
import { ExplicitDependency } from './explicit-project-dependencies';
import { PackageJson } from '../../../../utils/package-json';

export function buildExplicitPackageJsonDependencies(
  nxJsonConfiguration: NxJsonConfiguration,
  projectsConfigurations: ProjectsConfigurations,
  graph: ProjectGraph,
  filesToProcess: ProjectFileMap
) {
  const res = [] as any;
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
  collectedDeps: ExplicitDependency[],
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
          type: DependencyType.static,
        });
      } else if (graph.externalNodes[`npm:${d}`]) {
        collectedDeps.push({
          sourceProjectName: sourceProject,
          targetProjectName: `npm:${d}`,
          sourceProjectFile: fileName,
          type: DependencyType.static,
        });
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

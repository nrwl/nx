import { defaultFileRead } from '../file-utils';
import { join } from 'path';
import { ProjectFileMap, ProjectGraph } from '../../config/project-graph';
import { parseJson } from '../../utils/json';
import { getImportPath, joinPathFragments } from '../../utils/path';
import { ProjectsConfigurations } from '../../config/workspace-json-project-json';
import { NxJsonConfiguration } from '../../config/nx-json';

class ProjectGraphNodeRecords {}

export function buildExplicitPackageJsonDependencies(
  nxJsonConfiguration: NxJsonConfiguration,
  projectsConfigurations: ProjectsConfigurations,
  graph: ProjectGraph,
  filesToProcess: ProjectFileMap
) {
  const res = [] as any;
  let packageNameMap = undefined;
  Object.keys(filesToProcess).forEach((source) => {
    Object.values(filesToProcess[source]).forEach((f) => {
      if (
        isPackageJsonAtProjectRoot(
          graph.nodes as ProjectGraphNodeRecords,
          f.file
        )
      ) {
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
      res[
        packageJson.name ??
          getImportPath(nxJsonConfiguration.npmScope, projectName)
      ] = projectName;
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

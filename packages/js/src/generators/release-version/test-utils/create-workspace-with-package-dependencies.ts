import { ProjectGraph, Tree, writeJson } from '@nx/devkit';

interface ProjectAndPackageData {
  [projectName: string]: {
    projectRoot: string;
    packageName: string;
    version: string;
    packageJsonPath: string;
    localDependencies: {
      projectName: string;
      dependencyCollection:
        | 'dependencies'
        | 'devDependencies'
        | 'optionalDependencies';
      version: string;
    }[];
  };
}

export function createWorkspaceWithPackageDependencies(
  tree: Tree,
  projectAndPackageData: ProjectAndPackageData
): ProjectGraph {
  const projectGraph: ProjectGraph = {
    nodes: {},
    dependencies: {},
  };

  for (const [projectName, data] of Object.entries(projectAndPackageData)) {
    const packageJsonContents = {
      name: data.packageName,
      version: data.version,
    };
    for (const dependency of data.localDependencies) {
      const dependencyPackageName =
        projectAndPackageData[dependency.projectName].packageName;
      packageJsonContents[dependency.dependencyCollection] = {
        ...packageJsonContents[dependency.dependencyCollection],
        [dependencyPackageName]: dependency.version,
      };
    }
    // add the project and its nx project level dependencies to the projectGraph
    projectGraph.nodes[projectName] = {
      name: projectName,
      type: 'lib',
      data: {
        root: data.projectRoot,
      },
    };
    projectGraph.dependencies[projectName] = data.localDependencies.map(
      (dependency) => ({
        source: projectName,
        target: dependency.projectName,
        type: 'static',
      })
    );
    // create the package.json in the tree
    writeJson(tree, data.packageJsonPath, packageJsonContents);
  }

  return projectGraph;
}

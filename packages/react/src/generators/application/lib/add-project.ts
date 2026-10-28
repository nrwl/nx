import { NormalizedSchema } from '../schema';
import {
  addProjectConfiguration,
  joinPathFragments,
  ProjectConfiguration,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { type PackageJson } from '@nx/devkit/internal';

export function addProject(host: Tree, options: NormalizedSchema) {
  const project: ProjectConfiguration = {
    root: options.appProjectRoot,
    sourceRoot: `${options.appProjectRoot}/src`,
    projectType: 'application',
    targets: {},
    tags: options.parsedTags,
  };

  const packageJson: PackageJson = {
    name: options.importPath,
    version: '0.0.1',
    private: true,
  };

  if (!options.useProjectJson) {
    if (options.projectName !== options.importPath) {
      packageJson.nx = { name: options.projectName };
    }
    if (Object.keys(project.targets).length) {
      packageJson.nx ??= {};
      packageJson.nx.sourceRoot = joinPathFragments(
        options.appProjectRoot,
        'src'
      );
      packageJson.nx.targets = project.targets;
    }
    if (options.parsedTags?.length) {
      packageJson.nx ??= {};
      packageJson.nx.tags = options.parsedTags;
    }
  } else {
    addProjectConfiguration(host, options.projectName, {
      ...project,
    });
  }

  if (!options.useProjectJson || options.isUsingTsSolutionConfig) {
    // React Router already adds a package.json to the project root
    if (options.useReactRouter) {
      updateJson(
        host,
        joinPathFragments(options.appProjectRoot, 'package.json'),
        (json) => {
          return {
            name: packageJson.name,
            ...json,
          };
        }
      );
    } else {
      writeJson(
        host,
        joinPathFragments(options.appProjectRoot, 'package.json'),
        packageJson
      );
    }
  }
}

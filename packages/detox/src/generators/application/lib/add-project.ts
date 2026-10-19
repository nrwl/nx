import {
  addProjectConfiguration,
  joinPathFragments,
  Tree,
  writeJson,
} from '@nx/devkit';
import { NormalizedSchema } from './normalize-options';
import { type PackageJson } from '@nx/devkit/internal';

export function addProject(host: Tree, options: NormalizedSchema) {
  const packageJson: PackageJson = {
    name: options.importPath,
    version: '0.0.1',
    private: true,
  };

  if (!options.useProjectJson) {
    packageJson.nx = {
      name:
        options.e2eProjectName !== options.importPath
          ? options.e2eProjectName
          : undefined,
      implicitDependencies: [options.appProject],
    };
  } else {
    addProjectConfiguration(host, options.e2eProjectName, {
      root: options.e2eProjectRoot,
      sourceRoot: `${options.e2eProjectRoot}/src`,
      projectType: 'application',
      targets: {},
      tags: [],
      implicitDependencies: [options.appProject],
    });
  }

  if (!options.useProjectJson || options.isUsingTsSolutionConfig) {
    writeJson(
      host,
      joinPathFragments(options.e2eProjectRoot, 'package.json'),
      packageJson
    );
  }
}

import { type PackageJson } from '@nx/devkit/internal';
import { NormalizedSchema } from './normalize-options';
import {
  addProjectConfiguration,
  joinPathFragments,
  ProjectConfiguration,
  Tree,
  writeJson,
} from '@nx/devkit';
import { isUsingTsSolutionSetup } from '@nx/js/internal';
import { nextVersion } from '../../../utils/versions';
import { reactDomVersion, reactVersion } from '@nx/react';

export function addProject(host: Tree, options: NormalizedSchema) {
  const sourceRoot = options.src
    ? joinPathFragments(options.appProjectRoot, 'src')
    : options.appProjectRoot;

  const project: ProjectConfiguration = {
    root: options.appProjectRoot,
    sourceRoot,
    projectType: 'application',
    targets: {},
    tags: options.parsedTags,
  };

  const packageJson: PackageJson = {
    name: options.importPath,
    version: '0.0.1',
    private: true,
    dependencies: {
      next: nextVersion,
      react: reactVersion,
      'react-dom': reactDomVersion,
    },
  };

  if (!options.useProjectJson) {
    if (options.projectName !== options.importPath) {
      packageJson.nx = { name: options.projectName };
    }
    packageJson.nx ??= {};
    packageJson.nx.sourceRoot = sourceRoot;
    if (options.parsedTags?.length) {
      packageJson.nx.tags = options.parsedTags;
    }
  } else {
    addProjectConfiguration(host, options.projectName, {
      ...project,
    });
  }

  if (!options.useProjectJson || options.isTsSolutionSetup) {
    writeJson(
      host,
      joinPathFragments(options.appProjectRoot, 'package.json'),
      packageJson
    );
  }
}

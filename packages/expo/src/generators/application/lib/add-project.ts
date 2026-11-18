import { type PackageJson } from '@nx/devkit/internal';
import {
  addProjectConfiguration,
  joinPathFragments,
  ProjectConfiguration,
  readJson,
  Tree,
  writeJson,
} from '@nx/devkit';
import { NormalizedSchema } from './normalize-options';

export function addProject(host: Tree, options: NormalizedSchema) {
  const projectConfiguration: ProjectConfiguration = {
    root: options.appProjectRoot,
    sourceRoot: `${options.appProjectRoot}/src`,
    projectType: 'application',
    targets: {},
    tags: options.parsedTags,
  };

  const templatedPackageJson = readJson(
    host,
    joinPathFragments(options.appProjectRoot, 'package.json')
  );

  const packageJson: PackageJson = {
    ...templatedPackageJson,
    name: options.importPath,
    version: '0.0.1',
    private: true,
  };

  if (!options.useProjectJson) {
    if (options.importPath !== options.projectName) {
      packageJson.nx = { name: options.projectName };
    }
    if (options.parsedTags?.length) {
      packageJson.nx ??= {};
      packageJson.nx.tags = options.parsedTags;
    }
  } else {
    addProjectConfiguration(host, options.projectName, projectConfiguration);
  }

  if (!options.useProjectJson || options.isTsSolutionSetup) {
    writeJson(
      host,
      joinPathFragments(options.appProjectRoot, 'package.json'),
      packageJson
    );
  }
}

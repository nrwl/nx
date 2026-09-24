import {
  addProjectConfiguration,
  joinPathFragments,
  ProjectConfiguration,
  readJson,
  Tree,
  writeJson,
} from '@nx/devkit';
import { NormalizedSchema } from './normalize-options';
import { type PackageJson } from '@nx/devkit/internal';

export function addProject(host: Tree, options: NormalizedSchema) {
  const project: ProjectConfiguration = {
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
    if (options.projectName !== options.importPath) {
      packageJson.nx = { name: options.projectName };
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

  if (!options.useProjectJson || options.isTsSolutionSetup) {
    writeJson(
      host,
      joinPathFragments(options.appProjectRoot, 'package.json'),
      packageJson
    );
  }
}

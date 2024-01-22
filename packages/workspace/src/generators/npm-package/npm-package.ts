import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  Tree,
  writeJson,
} from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  type ProjectNameAndRootFormat,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { join } from 'path';
import { getImportPath } from '../../utilities/get-import-path';

export interface ProjectOptions {
  name: string;
  directory?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
}

interface NormalizedProjectOptions extends ProjectOptions {
  projectRoot: string;
}

async function normalizeOptions(
  tree: Tree,
  options: ProjectOptions
): Promise<NormalizedProjectOptions> {
  const { projectName, projectRoot } = await determineProjectNameAndRootOptions(
    tree,
    {
      name: options.name,
      projectType: 'library',
      directory: options.directory,
      projectNameAndRootFormat: options.projectNameAndRootFormat,
      callingGenerator: '@nx/workspace:npm-package',
    }
  );

  return {
    ...options,
    name: projectName,
    projectRoot,
  };
}

function addFiles(projectRoot: string, tree: Tree, options: ProjectOptions) {
  const packageJsonPath = join(projectRoot, 'package.json');
  writeJson(tree, packageJsonPath, {
    name: getImportPath(tree, options.name),
    version: '0.0.0',
    scripts: {
      test: 'node index.js',
    },
  });

  generateFiles(tree, join(__dirname, './files'), projectRoot, {});
}

export async function npmPackageGenerator(tree: Tree, options: ProjectOptions) {
  return await npmPackageGeneratorInternal(tree, {
    projectNameAndRootFormat: 'derived',
    ...options,
  });
}

export async function npmPackageGeneratorInternal(
  tree: Tree,
  _options: ProjectOptions
) {
  const options = await normalizeOptions(tree, _options);

  addProjectConfiguration(tree, options.name, {
    root: options.projectRoot,
  });

  const fileCount = tree.children(options.projectRoot).length;
  const projectJsonExists = tree.exists(
    join(options.projectRoot, 'project.json')
  );
  const isEmpty = fileCount === 0 || (fileCount === 1 && projectJsonExists);

  if (isEmpty) {
    addFiles(options.projectRoot, tree, options);
  }

  await formatFiles(tree);
}

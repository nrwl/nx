import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  Tree,
  writeJson,
} from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { join } from 'path';
import { getImportPath } from '../../utilities/get-import-path';

export interface ProjectOptions {
  directory: string;
  name?: string;
}

interface NormalizedProjectOptions extends ProjectOptions {
  projectRoot: string;
}

async function normalizeOptions(
  tree: Tree,
  options: ProjectOptions
): Promise<NormalizedProjectOptions> {
  await ensureProjectName(tree, options, 'library');
  const { projectName, projectRoot } = await determineProjectNameAndRootOptions(
    tree,
    {
      name: options.name,
      projectType: 'library',
      directory: options.directory,
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

export async function npmPackageGenerator(
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

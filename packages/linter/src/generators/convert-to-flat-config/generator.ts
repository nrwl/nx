import {
  formatFiles,
  getProjects,
  ProjectConfiguration,
  readJson,
  Tree,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { ConvertToFlatConfigGeneratorSchema } from './schema';
import { findEslintFile } from '../utils/eslint-file';
import { convertEslintJsonToFlatConfig } from './converters/json-converter';

export async function convertToFlatConfigGenerator(
  tree: Tree,
  options: ConvertToFlatConfigGeneratorSchema
) {
  const eslintFile = findEslintFile(tree);
  if (!eslintFile) {
    throw new Error('Could not find root eslint file');
  }
  if (!eslintFile.endsWith('.json')) {
    throw new Error(
      'Only json eslint config files are supported for conversion'
    );
  }

  // rename root eslint config to eslint.config.js
  convertRootToFlatConfig(tree);
  // rename and map files
  const projects = getProjects(tree);
  for (const [project, projectConfig] of projects) {
    convertProjectToFlatConfig(tree, project, projectConfig);
  }
  // replace references in nx.json
  updateNxJsonConfig(tree);
  // install missing packages

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default convertToFlatConfigGenerator;

function convertRootToFlatConfig(tree: Tree) {
  if (tree.exists('.eslintrc.base.json')) {
    convertConfigToFlatConfig(
      tree,
      '',
      '.eslintrc.base.json',
      'eslint.base.config.js'
    );
  }
  if (tree.exists('.eslintrc.json')) {
    convertConfigToFlatConfig(tree, '', '.eslintrc.json', 'eslint.config.js');
  }
}

function convertProjectToFlatConfig(
  tree: Tree,
  project: string,
  projectConfig: ProjectConfiguration
) {
  if (tree.exists(`${projectConfig.root}/.eslintrc.json`)) {
    if (projectConfig.targets) {
      const eslintTargets = Object.keys(projectConfig.targets).filter(
        (t) => projectConfig.targets[t].executor === '@nrwl/linter:eslint'
      );
      for (const target of eslintTargets) {
        projectConfig.targets[target].options = {
          ...projectConfig.targets[target].options,
          eslintConfig: `${projectConfig.root}/eslint.config.js`,
        };
      }
      updateProjectConfiguration(tree, project, projectConfig);
    }

    convertConfigToFlatConfig(
      tree,
      projectConfig.root,
      '.eslintrc.json',
      'eslint.config.js'
    );
  }
}

// update names of eslint files in nx.json
// and remove eslintignore
function updateNxJsonConfig(tree: Tree) {
  if (tree.exists('nx.json')) {
    const content = tree.read('nx.json', 'utf-8');
    const strippedConfig: string = content
      .replace('.eslintrc.json', 'eslint.config.js')
      .replace('.eslintrc.base.json', 'eslint.config.base.js')
      .replace(/".*\.eslintignore.json",?/, '');
    updateNxJson(tree, JSON.parse(strippedConfig));
  }
}

function convertConfigToFlatConfig(
  tree: Tree,
  root: string,
  source: string,
  target: string
) {
  // read original config
  const config = readJson(tree, `${root}/${source}`);

  convertEslintJsonToFlatConfig(tree, root, config, source, target);
}

import type { Tree } from '@nrwl/devkit';
import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
} from '@nrwl/devkit';
import { getComponentProps } from '../utils/storybook';
import { getComponentSelector } from './lib/get-component-selector';
import { getArgsDefaultValue } from './lib/get-args-default-value';
import type { ComponentCypressSpecGeneratorOptions } from './schema';

export function componentCypressSpecGenerator(
  tree: Tree,
  options: ComponentCypressSpecGeneratorOptions
): void {
  const {
    cypressProject,
    projectName,
    projectPath,
    componentPath,
    componentFileName,
    componentName,
  } = options;
  const e2eProjectName = cypressProject || `${projectName}-e2e`;
  const e2eProjectRoot = readProjectConfiguration(
    tree,
    e2eProjectName
  ).sourceRoot;
  const e2eLibIntegrationFolderPath = joinPathFragments(
    e2eProjectRoot,
    'integration'
  );

  const templatesDir = joinPathFragments(__dirname, 'files');
  const destinationDir = joinPathFragments(
    e2eLibIntegrationFolderPath,
    componentPath
  );
  const storyFile = joinPathFragments(
    destinationDir,
    `${componentFileName}.spec.ts`
  );

  if (tree.exists(storyFile)) {
    return;
  }

  const fullComponentPath = joinPathFragments(
    projectPath,
    componentPath,
    `${componentFileName}.ts`
  );
  const props = getComponentProps(tree, fullComponentPath, getArgsDefaultValue);
  const componentSelector = getComponentSelector(tree, fullComponentPath);

  generateFiles(tree, templatesDir, destinationDir, {
    projectName,
    componentFileName,
    componentName,
    componentSelector,
    props,
    tmpl: '',
  });

  if (!options.skipFormat) {
    formatFiles(tree);
  }
}

export default componentCypressSpecGenerator;

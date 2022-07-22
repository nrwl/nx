import type { Tree } from '@nrwl/devkit';
import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
} from '@nrwl/devkit';
import { getComponentProps } from '../utils/storybook';
import { getArgsDefaultValue } from './lib/get-args-default-value';
import { getComponentSelector } from './lib/get-component-selector';
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
    specDirectory,
  } = options;
  const e2eProjectName = cypressProject || `${projectName}-e2e`;
  const { sourceRoot, root } = readProjectConfiguration(tree, e2eProjectName);
  const isCypressV10 = tree.exists(
    joinPathFragments(root, 'cypress.config.ts')
  );
  const e2eLibIntegrationFolderPath = joinPathFragments(
    sourceRoot,
    isCypressV10 ? 'e2e' : 'integration'
  );

  const templatesDir = joinPathFragments(__dirname, 'files');
  const destinationDir = joinPathFragments(
    e2eLibIntegrationFolderPath,
    specDirectory ?? componentPath
  );
  const storyFile = joinPathFragments(
    destinationDir,
    `${componentFileName}.${isCypressV10 ? 'cy' : 'spec'}.ts`
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
    fileExt: isCypressV10 ? 'cy.ts' : 'spec.ts',
  });

  if (!options.skipFormat) {
    formatFiles(tree);
  }
}

export default componentCypressSpecGenerator;

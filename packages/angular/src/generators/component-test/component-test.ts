import { assertMinimumCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import {
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import {
  getArgsDefaultValue,
  getComponentProps,
} from '../utils/storybook-ast/storybook-inputs';
import { ComponentTestSchema } from './schema';

export function componentTestGenerator(
  tree: Tree,
  options: ComponentTestSchema
) {
  assertMinimumCypressVersion(10);
  const { root } = readProjectConfiguration(tree, options.project);
  const componentDirPath = joinPathFragments(root, options.componentDir);
  const componentFilePath = joinPathFragments(
    componentDirPath,
    `${options.componentFileName}.ts`
  );
  const componentTestFilePath = joinPathFragments(
    componentDirPath,
    `${options.componentFileName}.cy.ts`
  );

  if (tree.exists(componentFilePath) && !tree.exists(componentTestFilePath)) {
    const props = getComponentProps(
      tree,
      componentFilePath,
      getArgsDefaultValue,
      false
    );
    generateFiles(
      tree,
      joinPathFragments(__dirname, 'files'),
      componentDirPath,
      {
        componentName: options.componentName,
        componentFileName: options.componentFileName.startsWith('./')
          ? options.componentFileName.slice(2)
          : options.componentFileName,
        props: props.filter((p) => typeof p.defaultValue !== 'undefined'),
        tpl: '',
      }
    );
  }
}

export default componentTestGenerator;

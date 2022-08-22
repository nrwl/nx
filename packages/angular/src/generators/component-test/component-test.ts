import { assertMinimumCypressVersion } from '@nrwl/cypress/src/utils/cypress-version';
import { generateFiles, joinPathFragments, Tree } from '@nrwl/devkit';
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
  const componentDirPath = joinPathFragments(
    options.projectPath,
    options.componentDir
  );
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
        componentFileName: options.componentFileName,
        props: props.filter((p) => typeof p.defaultValue !== 'undefined'),
        tpl: '',
      }
    );
  }
}

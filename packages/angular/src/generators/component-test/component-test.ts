import {
  ensurePackage,
  formatFiles,
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';
import {
  getArgsDefaultValue,
  getComponentProps,
} from '../utils/storybook-ast/storybook-inputs';
import { ComponentTestSchema } from './schema';

export async function componentTestGenerator(
  tree: Tree,
  options: ComponentTestSchema
) {
  ensurePackage('@nx/cypress', nxVersion);
  const { assertMinimumCypressVersion } = <
    typeof import('@nx/cypress/src/utils/cypress-version')
  >require('@nx/cypress/src/utils/cypress-version');
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

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default componentTestGenerator;

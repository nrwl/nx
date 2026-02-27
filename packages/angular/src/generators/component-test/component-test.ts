import {
  addDependenciesToPackageJson,
  ensurePackage,
  formatFiles,
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';
import {
  getArgsDefaultValue,
  getComponentProps,
} from '../utils/storybook-ast/storybook-inputs';
import { versions } from '../utils/version-utils';
import type { ComponentTestSchema } from './schema';

export async function componentTestGenerator(
  tree: Tree,
  options: ComponentTestSchema
) {
  ensurePackage('@nx/cypress', nxVersion);
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

  const tasks: GeneratorCallback[] = [];
  if (!options.skipPackageJson) {
    // Cypress CT still requires @angular/platform-browser-dynamic
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        {
          '@angular/platform-browser-dynamic': versions(tree).angularVersion,
        },
        undefined,
        true
      )
    );
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default componentTestGenerator;

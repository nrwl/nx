import { getModuleDeclaredComponents } from '@nrwl/angular/src/generators/stories/lib/module-info';
import type { PropertyDeclaration } from 'typescript';
import { getComponentProps } from '../utils/storybook';
import { assertMinimumCypressVersion } from '@nrwl/cypress/src/utils/cypress-version';
import {
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { dirname, relative, basename, extname } from 'path';
import { ComponentTestSchema } from './schema';
export function componentTestGenerator(
  tree: Tree,
  options: ComponentTestSchema
) {
  // TODO: enable this assert
  // assertMinimumCypressVersion(10);
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

// TODO: pulled this from component-story
function getArgsDefaultValue(property: PropertyDeclaration): string {
  const typeNameToDefault = {
    string: "''",
    number: '0',
    boolean: 'false',
  };
  return property.initializer
    ? property.initializer.getText()
    : property.type
    ? typeNameToDefault[property.type.getText()]
    : "''";
}

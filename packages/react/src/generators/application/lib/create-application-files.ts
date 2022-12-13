import { NormalizedSchema } from '../schema';
import {
  names,
  offsetFromRoot,
  Tree,
  toJS,
  generateFiles,
} from '@nrwl/devkit';
import { join } from 'path';
import { getRelativePathToRootTsConfig } from '@nrwl/workspace/src/utilities/typescript';
import { createTsConfig } from '../../../utils/create-ts-config';

export function createApplicationFiles(host: Tree, options: NormalizedSchema) {
  let styleSolutionSpecificAppFiles: string;
  if (options.styledModule && options.style !== 'styled-jsx') {
    styleSolutionSpecificAppFiles = '../files/styled-module';
  } else if (options.style === 'styled-jsx') {
    styleSolutionSpecificAppFiles = '../files/styled-jsx';
  } else if (options.style === 'none') {
    styleSolutionSpecificAppFiles = '../files/none';
  } else if (options.globalCss) {
    styleSolutionSpecificAppFiles = '../files/global-css';
  } else {
    styleSolutionSpecificAppFiles = '../files/css-module';
  }

  const relativePathToRootTsConfig = getRelativePathToRootTsConfig(
    host,
    options.appProjectRoot
  );
  const templateVariables = {
    ...names(options.name),
    ...options,
    tmpl: '',
    offsetFromRoot: offsetFromRoot(options.appProjectRoot),
  };

  generateFiles(
    host,
    join(
      __dirname,
      options.bundler === 'vite' ? '../files/common-vite' : '../files/common'
    ),
    options.appProjectRoot,
    templateVariables
  );

  if (
    options.unitTestRunner === 'none' ||
    (options.unitTestRunner === 'vitest' && options.inSourceTests == true)
  ) {
    host.delete(
      `${options.appProjectRoot}/src/app/${options.fileName}.spec.tsx`
    );
  }

  if (!options.skipNxWelcomeComponent) {
    generateFiles(
      host,
      join(__dirname, '../files/nx-welcome'),
      options.appProjectRoot,
      templateVariables
    );
  }

  generateFiles(
    host,
    join(__dirname, styleSolutionSpecificAppFiles),
    options.appProjectRoot,
    templateVariables
  );

  if (options.unitTestRunner === 'vitest' && options.inSourceTests == true) {
    let originalAppContents = host
      .read(`${options.appProjectRoot}/src/app/${options.fileName}.tsx`)
      .toString();
    originalAppContents += `
    if (import.meta.vitest) {
      // add tests related to your file here
      // For more information please visit the Vitest docs site here: https://vitest.dev/guide/in-source.html
    }
    `;
  }

  if (options.js) {
    toJS(host);
  }

  createTsConfig(
    host,
    options.appProjectRoot,
    'app',
    options,
    relativePathToRootTsConfig
  );
}

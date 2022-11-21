import { NormalizedSchema } from '../schema';
import {
  names,
  offsetFromRoot,
  Tree,
  toJS,
  generateFiles,
  joinPathFragments,
  updateJson,
} from '@nrwl/devkit';
import { join } from 'path';
import { getRelativePathToRootTsConfig } from '@nrwl/workspace/src/utilities/typescript';

function updateTsConfig(host: Tree, options: NormalizedSchema) {
  updateJson(
    host,
    joinPathFragments(options.appProjectRoot, 'tsconfig.json'),
    (json) => {
      if (options.strict) {
        json.compilerOptions = {
          ...json.compilerOptions,
          forceConsistentCasingInFileNames: true,
          strict: true,
          noImplicitOverride: true,
          noPropertyAccessFromIndexSignature: true,
          noImplicitReturns: true,
          noFallthroughCasesInSwitch: true,
        };
      }

      return json;
    }
  );
}

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

  const templateVariables = {
    ...names(options.name),
    ...options,
    tmpl: '',
    offsetFromRoot: offsetFromRoot(options.appProjectRoot),
    rootTsConfigPath: getRelativePathToRootTsConfig(
      host,
      options.appProjectRoot
    ),
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

  updateTsConfig(host, options);
}

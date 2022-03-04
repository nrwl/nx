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
import { getRootTsConfigPathInTree } from '@nrwl/workspace/src/utilities/typescript';

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

  const rootOffset = offsetFromRoot(options.appProjectRoot);
  const templateVariables = {
    ...names(options.name),
    ...options,
    tmpl: '',
    offsetFromRoot: rootOffset,
    rootTsConfigPath: rootOffset + getRootTsConfigPathInTree(host),
  };

  generateFiles(
    host,
    join(__dirname, '../files/common'),
    options.appProjectRoot,
    templateVariables
  );

  if (options.unitTestRunner === 'none') {
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

  if (options.js) {
    toJS(host);
  }

  updateTsConfig(host, options);
}

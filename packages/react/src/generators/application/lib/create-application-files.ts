import { NormalizedSchema } from '../schema';
import { names, offsetFromRoot, Tree, toJS, generateFiles } from '@nrwl/devkit';
import { join } from 'path';

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
}

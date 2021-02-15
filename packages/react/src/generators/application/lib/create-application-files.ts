import { NormalizedSchema } from '../schema';
import { names, offsetFromRoot, Tree, toJS, generateFiles } from '@nrwl/devkit';
import { join } from 'path';

export function createApplicationFiles(host: Tree, options: NormalizedSchema) {
  let styleSolutionSpecificAppFiles: string;
  if (options.styledModule) {
    switch (options.style) {
      case 'styled-jsx':
        styleSolutionSpecificAppFiles = '../files/styled-jsx';
        break;
      case '@material-ui':
        styleSolutionSpecificAppFiles = '../files/material-ui';
        break;
      case 'none':
        styleSolutionSpecificAppFiles = '../files/none';
        break;
      default:
        styleSolutionSpecificAppFiles = '../files/styled-module';
    }
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

import {
  apply,
  chain,
  filter,
  mergeWith,
  move,
  noop,
  Rule,
  template,
  url,
} from '@angular-devkit/schematics';
import { toJS } from '@nrwl/workspace/src/utils/rules/to-js';
import { NormalizedSchema } from '../schema';
import { names, offsetFromRoot } from '@nrwl/devkit';

export function createApplicationFiles(options: NormalizedSchema): Rule {
  let styleSolutionSpecificAppFiles: string;
  if (options.styledModule && options.style !== 'styled-jsx') {
    styleSolutionSpecificAppFiles = './files/styled-module';
  } else if (options.style === 'styled-jsx') {
    styleSolutionSpecificAppFiles = './files/styled-jsx';
  } else if (options.style === 'none') {
    styleSolutionSpecificAppFiles = './files/none';
  } else if (options.globalCss) {
    styleSolutionSpecificAppFiles = './files/global-css';
  } else {
    styleSolutionSpecificAppFiles = './files/css-module';
  }

  const templateVariables = {
    ...names(options.name),
    ...options,
    tmpl: '',
    offsetFromRoot: offsetFromRoot(options.appProjectRoot),
  };

  return chain([
    mergeWith(
      apply(url(`./files/common`), [
        template(templateVariables),
        options.unitTestRunner === 'none'
          ? filter((file) => file !== `/src/app/${options.fileName}.spec.tsx`)
          : noop(),
        move(options.appProjectRoot),
        options.js ? toJS() : noop(),
      ])
    ),
    mergeWith(
      apply(url(styleSolutionSpecificAppFiles), [
        template(templateVariables),
        move(options.appProjectRoot),
        options.js ? toJS() : noop(),
      ])
    ),
  ]);
}

import {
  apply,
  filter,
  mergeWith,
  move,
  noop,
  Rule,
  template,
  url,
} from '@angular-devkit/schematics';
import { names, offsetFromRoot } from '@nrwl/workspace';
import { toJS } from '@nrwl/workspace/src/utils/rules/to-js';
import { NormalizedSchema } from '../schema';

export function createApplicationFiles(options: NormalizedSchema): Rule {
  return mergeWith(
    apply(url(`./files/app`), [
      template({
        ...names(options.name),
        ...options,
        tmpl: '',
        offsetFromRoot: offsetFromRoot(options.appProjectRoot),
      }),
      options.styledModule || !options.hasStyles
        ? filter((file) => !file.endsWith(`.${options.style}`))
        : noop(),
      options.unitTestRunner === 'none'
        ? filter((file) => file !== `/src/app/${options.fileName}.spec.tsx`)
        : noop(),
      move(options.appProjectRoot),
      options.js ? toJS() : noop(),
    ])
  );
}

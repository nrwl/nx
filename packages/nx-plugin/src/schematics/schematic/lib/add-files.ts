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
import { names } from '@nrwl/workspace';
import { NormalizedSchema } from '../schema';

export function addFiles(options: NormalizedSchema): Rule {
  return mergeWith(
    apply(url(`./files/schematic`), [
      template({
        ...options,
        ...names(options.name),
        tmpl: '',
      }),
      options.unitTestRunner === 'none'
        ? filter((file) => !file.endsWith('.spec.ts'))
        : noop(),
      move(`${options.projectSourceRoot}/schematics`),
    ])
  );
}

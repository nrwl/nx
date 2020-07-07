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
import { NormalizedSchema } from '../schema';

export function addFiles(options: NormalizedSchema): Rule {
  return mergeWith(
    apply(url(`./files/migration`), [
      template({
        ...options,
        tmpl: '',
      }),
      options.unitTestRunner === 'none'
        ? filter((file) => !file.endsWith('.spec.ts'))
        : noop(),
      move(`${options.projectSourceRoot}/migrations`),
    ])
  );
}

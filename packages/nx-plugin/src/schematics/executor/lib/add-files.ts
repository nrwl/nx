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
import { names } from '@nrwl/devkit';

export function addFiles(options: NormalizedSchema): Rule {
  return mergeWith(
    apply(url(`./files/executor`), [
      template({
        ...options,
        ...names(options.name),
        tmpl: '',
      }),
      options.unitTestRunner === 'none'
        ? filter((file) => !file.endsWith('.spec.ts'))
        : noop(),
      move(`${options.projectSourceRoot}/executors`),
    ])
  );
}

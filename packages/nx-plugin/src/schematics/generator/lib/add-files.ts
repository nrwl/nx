import {
  apply,
  filter,
  mergeWith,
  move,
  noop,
  Rule,
  template,
  Tree,
  url,
} from '@angular-devkit/schematics';
import { names } from '@nrwl/devkit';
import { NormalizedSchema } from '../schema';

export function addFiles(host: Tree, options: NormalizedSchema): Rule {
  const indexPath = `${options.projectSourceRoot}/generators/${options.fileName}/files/src/index.ts__template__`;

  if (!host.exists(indexPath)) {
    host.create(indexPath, options.fileTemplate);
  }

  return mergeWith(
    apply(url(`./files/generator`), [
      template({
        ...options,
        ...names(options.name),
        tmpl: '',
      }),
      options.unitTestRunner === 'none'
        ? filter((file) => !file.endsWith('.spec.ts'))
        : noop(),
      move(`${options.projectSourceRoot}/generators`),
    ])
  );
}

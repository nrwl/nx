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
import { names } from '@nrwl/workspace';
import { NormalizedSchema } from '../schema';

export function addFiles(host: Tree, options: NormalizedSchema): Rule {
  const indexPath = `${options.projectSourceRoot}/schematics/${options.fileName}/files/src/index.ts__template__`;

  if (!host.exists(indexPath)) {
    host.create(indexPath, options.fileTemplate);
  }

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

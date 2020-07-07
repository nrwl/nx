import { normalize } from '@angular-devkit/core';
import {
  apply,
  chain,
  MergeStrategy,
  mergeWith,
  move,
  Rule,
  schematic,
  template,
  url,
} from '@angular-devkit/schematics';
import { names, offsetFromRoot } from '@nrwl/workspace';
import { allFilesInDirInHost } from '@nrwl/workspace/src/utils/ast-utils';
import { NormalizedSchema } from '../schema';

export function addFiles(options: NormalizedSchema): Rule {
  return chain([
    (host) => {
      allFilesInDirInHost(
        host,
        normalize(`${options.projectRoot}/src/lib`)
      ).forEach((file) => {
        host.delete(file);
      });

      return host;
    },
    mergeWith(
      apply(url(`./files/plugin`), [
        template({
          ...options,
          ...names(options.name),
          tmpl: '',
          offsetFromRoot: offsetFromRoot(options.projectRoot),
        }),
        move(options.projectRoot),
      ]),
      MergeStrategy.Overwrite
    ),
    schematic('schematic', {
      project: options.name,
      name: options.name,
      unitTestRunner: options.unitTestRunner,
    }),
    schematic('builder', {
      project: options.name,
      name: 'build',
      unitTestRunner: options.unitTestRunner,
    }),
  ]);
}

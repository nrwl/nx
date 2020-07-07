import {
  apply,
  mergeWith,
  move,
  Rule,
  template,
  url,
} from '@angular-devkit/schematics';
import { offsetFromRoot } from '@nrwl/workspace';
import { NxPluginE2ESchema } from '../schema';

export function addFiles(options: NxPluginE2ESchema): Rule {
  return mergeWith(
    apply(url('./files'), [
      template({
        tmpl: '',
        ...options,
        offsetFromRoot: offsetFromRoot(options.projectRoot),
      }),
      move(options.projectRoot),
    ])
  );
}

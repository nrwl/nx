import {
  apply,
  branchAndMerge,
  chain,
  mergeWith,
  Rule,
  template,
  url,
  move
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import { wrapIntoFormat } from '@nrwl/schematics/src/utils/tasks';
import { toFileName } from '@nrwl/schematics/src/utils/name-utils';

export default function(schema: Schema): Rule {
  return wrapIntoFormat(() => {
    const options = normalizeOptions(schema);
    const templateSource = apply(url('./files'), [
      template({
        dot: '.',
        tmpl: '',
        ...(options as any)
      }),
      move('tools/schematics')
    ]);
    return chain([branchAndMerge(chain([mergeWith(templateSource)]))]);
  });
}

function normalizeOptions(options: Schema): Schema {
  const name = toFileName(options.name);
  return { ...options, name };
}

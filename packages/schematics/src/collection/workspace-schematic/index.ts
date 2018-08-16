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
import { toFileName } from '../../utils/name-utils';
import { formatFiles } from '../../utils/rules/format-files';
import { excludeUnnecessaryFiles } from '@nrwl/schematics/src/utils/rules/filter-tree';

export default function(schema: Schema): Rule {
  const options = normalizeOptions(schema);
  const templateSource = apply(url('./files'), [
    excludeUnnecessaryFiles(),
    template({
      dot: '.',
      tmpl: '',
      ...(options as any)
    }),
    move('tools/schematics')
  ]);
  return chain([
    branchAndMerge(chain([mergeWith(templateSource)])),
    formatFiles(options)
  ]);
}

function normalizeOptions(options: Schema): Schema {
  const name = toFileName(options.name);
  return { ...options, name };
}

import {normalize, strings} from '@angular-devkit/core';
import {apply, branchAndMerge, chain, externalSchematic, mergeWith, move, Rule, SchematicsException, template, url,} from '@angular-devkit/schematics';

import {wrapIntoFormat} from '../../../../schematics/src/utils/tasks';
import {Schema} from './schema';

interface NormalizedSchema extends Schema {
  fullName: string;
  fullPath: string;
}

export default function(schema: Schema): Rule {
  return wrapIntoFormat(() => {
    schema.path = schema.path ? normalize(schema.path) : schema.path;
    const sourceDir = schema.sourceDir;
    if (!sourceDir) {
      throw new SchematicsException(`sourceDir option is required.`);
    }

    const templateSource = apply(url('./files'), [
      template({
        ...strings,
        'if-flat': (s: string) => (schema.flat ? '' : s),
        ...schema
      }),
      move(sourceDir)
    ]);

    return chain([
      branchAndMerge(chain([mergeWith(templateSource)])),
      externalSchematic('@schematics/angular', 'module', schema)
    ]);
  });
}

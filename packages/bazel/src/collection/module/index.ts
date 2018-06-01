import { normalize, strings } from '@angular-devkit/core';
import {
  apply,
  branchAndMerge,
  chain,
  externalSchematic,
  mergeWith,
  move,
  Rule,
  SchematicContext,
  SchematicsException,
  template,
  Tree,
  url,
  TaskConfigurationGenerator,
  TaskConfiguration
} from '@angular-devkit/schematics';

import { Schema } from './schema';
import { formatFiles } from '../../utils/rules/format-files';

export default function(schema: Schema): Rule {
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
    externalSchematic('@schematics/angular', 'module', schema),
    formatFiles(schema)
  ]);
}

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

class FormatFiles implements TaskConfigurationGenerator<any> {
  toConfiguration(): TaskConfiguration<any> {
    return {
      name: 'node-package',
      options: {
        command: 'run format',
        quiet: true
      }
    };
  }
}

function wrapIntoFormat(fn: Function): any {
  return (host: Tree, context: SchematicContext) => {
    context.addTask(new FormatFiles());
    return fn(context)(host, context);
  };
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

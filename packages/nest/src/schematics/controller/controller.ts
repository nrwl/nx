import {
  chain,
  externalSchematic,
  noop,
  Rule,
  SchematicContext,
  Tree
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import { normalizeProjectOptions } from '../../utils/normalize';
import { addExportsToBarrelFile, createFiles } from '../../utils/files';
import { formatFiles } from '@nrwl/workspace';

export interface NormalizedSchema extends Schema {
  fileName: string;
  projectRoot: string;
  projectDirectory: string;
}

export default function(schema: Schema): Rule {
  return async (host: Tree, context: SchematicContext) => {
    const options: NormalizedSchema = await normalizeProjectOptions(
      host,
      schema
    );

    return chain([
      createFiles(options),
      ...runExternalSchematics(options),
      addExportsToBarrelFile(options, [
        `export * from './lib/${options.fileName}.controller';`
      ]),
      formatFiles(options)
    ]);
  };
}

export function runExternalSchematics(options: NormalizedSchema): Rule[] {
  return [
    options.service
      ? externalSchematic('@nrwl/nest', 'service', {
          ...options
        })
      : noop()
  ];
}
